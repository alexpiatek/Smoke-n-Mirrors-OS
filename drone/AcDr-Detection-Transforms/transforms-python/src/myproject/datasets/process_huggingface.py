"""Transform that reads the Hugging Face drone-audio-detection-samples dataset
(uploaded as parquet) and runs the spectral analysis detection algorithm on
each audio sample. Compares predictions against ground truth labels.
"""
import io
import wave
import tempfile
import numpy as np
from scipy.fftpack import dct
from transforms.api import transform, Input, Output
import pyspark.sql.functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType, BooleanType, IntegerType
)

# Output dataset path
OUTPUT_PATH = "/Users/drew@hooperco.org/AcDr Detection/huggingface_detections"

# Hugging Face dataset RID
HF_DATASET = "ri.foundry.main.dataset.dc3acf89-16a0-4e5f-a6ed-642bb8e6b0cc"

# Detection parameters
DRONE_FREQ_LOW = 100.0
DRONE_FREQ_HIGH = 500.0
N_MELS = 26
N_MFCC = 5

# Result schema
RESULT_SCHEMA = StructType([
    StructField("sample_rate", IntegerType(), True),
    StructField("duration_sec", DoubleType(), True),
    StructField("total_rms_energy", DoubleType(), True),
    StructField("drone_band_energy", DoubleType(), True),
    StructField("drone_band_ratio", DoubleType(), True),
    StructField("spectral_centroid_hz", DoubleType(), True),
    StructField("dominant_freq_hz", DoubleType(), True),
    StructField("mfcc_mean_0", DoubleType(), True),
    StructField("mfcc_mean_1", DoubleType(), True),
    StructField("mfcc_mean_2", DoubleType(), True),
    StructField("mfcc_mean_3", DoubleType(), True),
    StructField("mfcc_mean_4", DoubleType(), True),
    StructField("drone_detected", BooleanType(), True),
    StructField("confidence", DoubleType(), True),
    StructField("classification", StringType(), True),
    StructField("error", StringType(), True),
])


def _hz_to_mel(hz):
    return 2595.0 * np.log10(1.0 + hz / 700.0)


def _mel_to_hz(mel):
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def _mel_filterbank(sr, n_fft, n_mels=N_MELS):
    low_mel = _hz_to_mel(0)
    high_mel = _hz_to_mel(sr / 2)
    mel_points = np.linspace(low_mel, high_mel, n_mels + 2)
    hz_points = _mel_to_hz(mel_points)
    bin_points = np.floor((n_fft + 1) * hz_points / sr).astype(int)
    n_freqs = n_fft // 2 + 1
    fbank = np.zeros((n_mels, n_freqs))
    for i in range(n_mels):
        for j in range(bin_points[i], bin_points[i + 1]):
            if j < n_freqs:
                fbank[i, j] = (j - bin_points[i]) / max(bin_points[i + 1] - bin_points[i], 1)
        for j in range(bin_points[i + 1], bin_points[i + 2]):
            if j < n_freqs:
                fbank[i, j] = (bin_points[i + 2] - j) / max(bin_points[i + 2] - bin_points[i + 1], 1)
    return fbank


def _compute_mfccs(y, sr, n_fft=2048, hop_length=512, n_mfcc=N_MFCC):
    n_frames = 1 + (len(y) - n_fft) // hop_length
    if n_frames < 1:
        return np.zeros(n_mfcc)
    frames = np.stack([y[i * hop_length:i * hop_length + n_fft] for i in range(n_frames)])
    window = np.hanning(n_fft)
    frames = frames * window
    fft_mag = np.abs(np.fft.rfft(frames, n=n_fft))
    power_spec = (fft_mag ** 2) / n_fft
    fbank = _mel_filterbank(sr, n_fft)
    mel_spec = np.dot(power_spec, fbank.T)
    mel_spec = np.where(mel_spec == 0, np.finfo(float).eps, mel_spec)
    log_mel_spec = np.log(mel_spec)
    mfccs = dct(log_mel_spec, type=2, axis=1, norm="ortho")[:, :n_mfcc]
    return np.mean(mfccs, axis=0)


def _load_wav_bytes(audio_bytes):
    with io.BytesIO(audio_bytes) as buf:
        with wave.open(buf, "rb") as wf:
            sr = wf.getframerate()
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            n_frames = wf.getnframes()
            raw = wf.readframes(n_frames)
    if sampwidth == 2:
        dtype = np.int16
    elif sampwidth == 4:
        dtype = np.int32
    elif sampwidth == 1:
        dtype = np.uint8
    else:
        dtype = np.int16
    data = np.frombuffer(raw, dtype=dtype).astype(np.float32)
    if n_channels > 1:
        data = data.reshape(-1, n_channels).mean(axis=1)
    if sampwidth == 1:
        data = (data - 128.0) / 128.0
    else:
        data = data / (2.0 ** (8 * sampwidth - 1))
    return data, sr


def _analyse_audio(audio_bytes):
    """Run full spectral analysis on WAV bytes. Returns a tuple matching RESULT_SCHEMA."""
    try:
        y, sr = _load_wav_bytes(audio_bytes)
        duration = float(len(y)) / sr
        rms = float(np.sqrt(np.mean(y ** 2)))

        # STFT averaged spectrum
        n_fft = 2048
        hop_length = 512
        n_frames = 1 + (len(y) - n_fft) // hop_length
        if n_frames < 1:
            n_fft = len(y)
            n_frames = 1

        if n_frames == 1:
            fft_mag = np.abs(np.fft.rfft(y[:n_fft], n=n_fft))
        else:
            window = np.hanning(n_fft)
            mag_sum = np.zeros(n_fft // 2 + 1)
            for i in range(n_frames):
                frame = y[i * hop_length:i * hop_length + n_fft] * window
                mag_sum += np.abs(np.fft.rfft(frame, n=n_fft))
            fft_mag = mag_sum / n_frames

        freqs = np.fft.rfftfreq(n_fft, d=1.0 / sr)

        # Band energy
        band_mask = (freqs >= DRONE_FREQ_LOW) & (freqs <= DRONE_FREQ_HIGH)
        drone_band_energy = float(np.sum(fft_mag[band_mask] ** 2))
        total_energy = float(np.sum(fft_mag ** 2))
        drone_band_ratio = drone_band_energy / total_energy if total_energy > 0 else 0.0

        # Spectral centroid (exclude DC)
        fft_mag_no_dc = fft_mag[1:]
        freqs_no_dc = freqs[1:]
        total_mag_no_dc = np.sum(fft_mag_no_dc)
        spectral_centroid = float(np.sum(freqs_no_dc * fft_mag_no_dc) / total_mag_no_dc) if total_mag_no_dc > 0 else 0.0

        # Dominant frequency (exclude DC)
        dominant_freq = float(freqs_no_dc[np.argmax(fft_mag_no_dc)])

        # MFCCs
        mfcc_means = _compute_mfccs(y, sr, n_fft=min(2048, len(y)), n_mfcc=N_MFCC)
        mfcc_list = [float(m) for m in mfcc_means]
        while len(mfcc_list) < N_MFCC:
            mfcc_list.append(0.0)

        # Threshold-based detection
        aircraft_present = mfcc_list[0] > -350 and rms > 0.04

        if not aircraft_present:
            classification = "background"
            mfcc_distance = min(max((-350 - mfcc_list[0]) / 200, 0), 1)
            rms_distance = min(max((0.04 - rms) / 0.04, 0), 1)
            confidence = 0.5 * mfcc_distance + 0.5 * rms_distance
            confidence = max(confidence, 0.3)
            detected = False
        else:
            is_drone = spectral_centroid > 4000 and mfcc_list[4] < -20
            is_helicopter = spectral_centroid < 3000 and mfcc_list[1] > 150

            if is_drone:
                classification = "drone"
                centroid_score = min((spectral_centroid - 4000) / 3000, 1.0)
                mfcc4_score = min((-20 - mfcc_list[4]) / 30, 1.0)
                confidence = 0.5 * centroid_score + 0.5 * mfcc4_score
                confidence = max(min(confidence, 1.0), 0.4)
                detected = True
            elif is_helicopter:
                classification = "helicopter"
                centroid_score = min((3000 - spectral_centroid) / 2000, 1.0)
                mfcc1_score = min((mfcc_list[1] - 150) / 80, 1.0)
                confidence = 0.5 * centroid_score + 0.5 * mfcc1_score
                confidence = max(min(confidence, 1.0), 0.4)
                detected = False
            else:
                classification = "unknown_aircraft"
                mfcc0_strength = min((mfcc_list[0] + 350) / 200, 1.0)
                rms_strength = min((rms - 0.04) / 0.06, 1.0)
                aircraft_strength = 0.5 * mfcc0_strength + 0.5 * rms_strength
                drone_proximity = (0.5 if spectral_centroid > 4000 else 0.0) + (0.5 if mfcc_list[4] < -20 else 0.0)
                heli_proximity = (0.5 if spectral_centroid < 3000 else 0.0) + (0.5 if mfcc_list[1] > 150 else 0.0)
                best_proximity = max(drone_proximity, heli_proximity)
                confidence = 0.3 + 0.4 * aircraft_strength + 0.3 * best_proximity
                confidence = max(min(confidence, 0.95), 0.3)
                detected = True

        return (
            int(sr), round(duration, 3), round(rms, 6),
            round(drone_band_energy, 4), round(drone_band_ratio, 4),
            round(spectral_centroid, 2), round(dominant_freq, 2),
            round(mfcc_list[0], 2), round(mfcc_list[1], 2),
            round(mfcc_list[2], 2), round(mfcc_list[3], 2), round(mfcc_list[4], 2),
            detected, round(confidence, 4), classification, None,
        )
    except Exception as e:
        return (
            None, None, None, None, None, None, None,
            None, None, None, None, None,
            None, None, None, str(e),
        )


@transform.spark.using(
    hf_input=Input(HF_DATASET),
    detections_output=Output(OUTPUT_PATH),
)
def detect_drones_huggingface(ctx, hf_input, detections_output):
    """Run drone detection on the Hugging Face audio dataset."""
    df = hf_input.dataframe()

    # Extract audio bytes from the struct column
    df_with_audio = df.select(
        F.col("audio.path").alias("source_file"),
        F.col("audio.bytes").alias("audio_bytes"),
        F.col("label").alias("ground_truth_label"),
    )

    # UDF to analyse each audio sample
    analyse_udf = F.udf(_analyse_audio, RESULT_SCHEMA)

    results_df = df_with_audio.withColumn(
        "analysis", analyse_udf(F.col("audio_bytes"))
    )

    # Flatten the results
    output_df = results_df.select(
        F.col("source_file"),
        F.col("ground_truth_label"),
        F.col("analysis.sample_rate"),
        F.col("analysis.duration_sec"),
        F.col("analysis.total_rms_energy"),
        F.col("analysis.drone_band_energy"),
        F.col("analysis.drone_band_ratio"),
        F.col("analysis.spectral_centroid_hz"),
        F.col("analysis.dominant_freq_hz"),
        F.col("analysis.mfcc_mean_0"),
        F.col("analysis.mfcc_mean_1"),
        F.col("analysis.mfcc_mean_2"),
        F.col("analysis.mfcc_mean_3"),
        F.col("analysis.mfcc_mean_4"),
        F.col("analysis.drone_detected"),
        F.col("analysis.confidence"),
        F.col("analysis.classification"),
        F.col("analysis.error"),
    )

    detections_output.write_dataframe(output_df)
