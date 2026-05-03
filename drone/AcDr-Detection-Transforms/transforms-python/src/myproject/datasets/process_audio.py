"""Transform that reads WAV audio files from the AcDr Audio Input MediaSet,
extracts spectral features relevant to drone detection, and produces a
structured output dataset with per-file detection results and audio features.

Drone propellers/motors typically produce acoustic signatures in the
100-500 Hz range. This transform computes spectral features in that band
and applies a simple energy-threshold classifier as a baseline. Replace
the threshold logic with an ML model for production use.
"""
import json
import tempfile
from transforms.api import transform, Output
from transforms.mediasets import MediaSetInput
import pyspark.sql.functions as F
from pyspark.sql.types import (
    StringType, DoubleType, IntegerType, BooleanType,
    StructType, StructField,
)


# Output dataset path
OUTPUT_PATH = "/Users/drew@hooperco.org/AcDr Detection/audio_detections"

# MediaSet RID for the audio input
AUDIO_MEDIA_SET = "ri.mio.main.media-set.1f55cdfb-ed81-441a-9e8d-1bfa42f41be4"

# Drone-characteristic frequency band (Hz)
DRONE_FREQ_LOW = 100.0
DRONE_FREQ_HIGH = 500.0

# Schema for the UDF return type
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
    StructField("error", StringType(), True),
    StructField("classification", StringType(), True),
])


@transform.spark.using(
    audio_input=MediaSetInput(AUDIO_MEDIA_SET),
    detections_output=Output(OUTPUT_PATH),
)
def detect_drones_from_audio(ctx, audio_input, detections_output):
    """Read WAV files from the MediaSet, extract audio features, detect drones."""

    # 1. List all media items in the MediaSet
    listed_df = audio_input.list_media_items_by_path_with_media_reference(ctx)

    # 2. UDF: process each audio file
    def analyse_audio(media_item_rid, path):
        import numpy as np
        import librosa

        try:
            with audio_input.get_media_item(media_item_rid) as f:
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
                    tmp.write(f.read())
                    tmp.flush()

                    # Load audio (mono, native sample rate)
                    y, sr = librosa.load(tmp.name, sr=None, mono=True)
                    duration = float(len(y)) / sr

                    # --- Spectral features ---

                    # RMS energy
                    rms = float(np.sqrt(np.mean(y ** 2)))

                    # FFT magnitude spectrum
                    n_fft = min(2048, len(y))
                    fft_mag = np.abs(np.fft.rfft(y, n=n_fft))
                    freqs = np.fft.rfftfreq(n_fft, d=1.0 / sr)

                    # Energy in drone-characteristic band (100-500 Hz)
                    band_mask = (freqs >= DRONE_FREQ_LOW) & (freqs <= DRONE_FREQ_HIGH)
                    drone_band_energy = float(np.sum(fft_mag[band_mask] ** 2))
                    total_energy = float(np.sum(fft_mag ** 2))
                    drone_band_ratio = drone_band_energy / total_energy if total_energy > 0 else 0.0

                    # Spectral centroid
                    sc = librosa.feature.spectral_centroid(y=y, sr=sr)
                    spectral_centroid = float(np.mean(sc))

                    # Dominant frequency
                    dominant_freq = float(freqs[np.argmax(fft_mag)])

                    # MFCCs (first 5 coefficients, mean over time)
                    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=5)
                    mfcc_means = [float(np.mean(mfccs[i])) for i in range(5)]

                    # --- Threshold-based detection ---
                    # Step 1: Is aircraft present?
                    #   MFCC_0 > -350 AND RMS > 0.04
                    aircraft_present = mfcc_means[0] > -350 and rms > 0.04

                    # Step 2: Classify aircraft type
                    classification = "background"
                    confidence = 0.0

                    if aircraft_present:
                        is_drone = spectral_centroid > 4000 and mfcc_means[4] < -20
                        is_helicopter = spectral_centroid < 3000 and mfcc_means[1] > 150

                        if is_drone:
                            classification = "drone"
                            # Confidence based on how far past thresholds
                            centroid_score = min((spectral_centroid - 4000) / 3000, 1.0)
                            mfcc4_score = min((-20 - mfcc_means[4]) / 40, 1.0)
                            confidence = round(0.5 + 0.25 * centroid_score + 0.25 * mfcc4_score, 4)
                        elif is_helicopter:
                            classification = "helicopter"
                            mfcc1_score = min((mfcc_means[1] - 150) / 50, 1.0)
                            centroid_score = min((3000 - spectral_centroid) / 2000, 1.0)
                            confidence = round(0.5 + 0.25 * mfcc1_score + 0.25 * centroid_score, 4)
                        else:
                            classification = "unknown_aircraft"
                            confidence = round(0.3 + 0.2 * min((mfcc_means[0] + 350) / 200, 1.0), 4)
                    else:
                        classification = "background"
                        confidence = round(max(0.0, 1.0 - (mfcc_means[0] + 350) / 200), 4)

                    detected = aircraft_present

                    return (
                        int(sr),
                        duration,
                        rms,
                        drone_band_energy,
                        drone_band_ratio,
                        spectral_centroid,
                        dominant_freq,
                        mfcc_means[0], mfcc_means[1], mfcc_means[2],
                        mfcc_means[3], mfcc_means[4],
                        bool(detected),
                        round(confidence, 4),
                        None,
                        classification,
                    )

        except Exception as e:
            return (
                None, None, None, None, None, None, None,
                None, None, None, None, None,
                None, None, str(e), None,
            )

    analyse_udf = F.udf(analyse_audio, RESULT_SCHEMA)

    # 3. Apply analysis across all audio items
    results_df = listed_df.withColumn(
        "analysis",
        analyse_udf(F.col("mediaItemRid"), F.col("path"))
    )

    # 4. Flatten the struct into top-level columns
    output_df = results_df.select(
        F.col("mediaItemRid"),
        F.col("path").alias("source_file"),
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
