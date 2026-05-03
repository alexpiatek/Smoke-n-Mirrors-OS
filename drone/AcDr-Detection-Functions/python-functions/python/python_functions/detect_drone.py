"""Live drone detection function.

Accepts base64-encoded WAV audio data, extracts spectral features,
and returns detection results with classification and confidence.
Uses only scipy and numpy (no librosa dependency).
ML classification powered by GradientBoostingClassifier trained on
synthetic data derived from real class statistics.
"""
import base64
import io
import struct
import tempfile
import wave
from dataclasses import dataclass

import numpy as np
from scipy.fftpack import dct
from sklearn.ensemble import GradientBoostingClassifier

from functions.api import function, Double, String

# Drone-characteristic frequency band (Hz)
DRONE_FREQ_LOW = 100.0
DRONE_FREQ_HIGH = 500.0

# Mel filterbank parameters for MFCC
N_MELS = 26
N_MFCC = 5

# Label mapping for the ML classifier
LABEL_MAP = {0: 'background', 1: 'drone', 2: 'helicopter'}

# --- Synthetic training data generation from class statistics ---
# Features: [total_rms_energy, drone_band_ratio, spectral_centroid_hz,
#            dominant_freq_hz, mfcc_mean_0, mfcc_mean_1, mfcc_mean_2,
#            mfcc_mean_3, mfcc_mean_4]

_SAMPLES_PER_CLASS = 300
_RNG = np.random.RandomState(42)

# Background (label=0) statistics
_BG_MEANS = np.array([0.045, 0.43, 2700.0, 300.0, -300.0, 130.0, -15.0, 35.0, -8.0])
_BG_STDS = np.array([0.035, 0.25, 1000.0, 400.0, 180.0, 30.0, 25.0, 20.0, 15.0])

# Drone (label=1) statistics
_DR_MEANS = np.array([0.26, 0.82, 2300.0, 300.0, -20.0, 80.0, -5.0, 5.0, -2.0])
_DR_STDS = np.array([0.10, 0.20, 900.0, 350.0, 60.0, 40.0, 15.0, 10.0, 5.0])

# Helicopter (label=2) statistics
_HE_MEANS = np.array([0.109, 0.52, 2551.0, 275.0, -174.0, 165.0, -26.0, 31.0, -10.0])
_HE_STDS = np.array([0.05, 0.20, 800.0, 350.0, 100.0, 30.0, 20.0, 15.0, 15.0])


def _generate_class_samples(means, stds, n_samples, rng):
    """Generate synthetic samples from a normal distribution per feature."""
    samples = np.column_stack([
        rng.normal(loc=m, scale=s, size=n_samples)
        for m, s in zip(means, stds)
    ])
    # Clip RMS and drone_band_ratio to valid ranges
    samples[:, 0] = np.clip(samples[:, 0], 0.001, None)  # RMS > 0
    samples[:, 1] = np.clip(samples[:, 1], 0.0, 1.0)     # ratio in [0, 1]
    samples[:, 2] = np.clip(samples[:, 2], 0.0, None)     # centroid >= 0
    samples[:, 3] = np.clip(samples[:, 3], 0.0, None)     # dominant freq >= 0
    return samples


# Generate training data
_X_bg = _generate_class_samples(_BG_MEANS, _BG_STDS, _SAMPLES_PER_CLASS, _RNG)
_X_dr = _generate_class_samples(_DR_MEANS, _DR_STDS, _SAMPLES_PER_CLASS, _RNG)
_X_he = _generate_class_samples(_HE_MEANS, _HE_STDS, _SAMPLES_PER_CLASS, _RNG)

_X_train = np.vstack([_X_bg, _X_dr, _X_he])
_y_train = np.array(
    [0] * _SAMPLES_PER_CLASS + [1] * _SAMPLES_PER_CLASS + [2] * _SAMPLES_PER_CLASS
)

# Train the classifier at module load time
_classifier = GradientBoostingClassifier(
    n_estimators=100,
    max_depth=4,
    learning_rate=0.1,
    random_state=42,
)
_classifier.fit(_X_train, _y_train)


@dataclass
class DroneDetectionResult:
    """Detection result returned to the caller."""
    classification: str
    confidence: Double
    drone_detected: bool
    sample_rate: int
    duration_sec: Double
    total_rms_energy: Double
    drone_band_ratio: Double
    spectral_centroid_hz: Double
    dominant_freq_hz: Double
    mfcc_0: Double
    mfcc_1: Double
    mfcc_4: Double


def _hz_to_mel(hz):
    return 2595.0 * np.log10(1.0 + hz / 700.0)


def _mel_to_hz(mel):
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def _mel_filterbank(sr, n_fft, n_mels=N_MELS):
    """Create a Mel-scale filterbank matrix."""
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
    """Compute MFCCs using scipy/numpy (no librosa)."""
    # Frame the signal
    n_frames = 1 + (len(y) - n_fft) // hop_length
    if n_frames < 1:
        return np.zeros(n_mfcc)

    frames = np.stack([y[i * hop_length:i * hop_length + n_fft] for i in range(n_frames)])

    # Windowing
    window = np.hanning(n_fft)
    frames = frames * window

    # FFT and power spectrum
    fft_mag = np.abs(np.fft.rfft(frames, n=n_fft))
    power_spec = (fft_mag ** 2) / n_fft

    # Mel filterbank
    fbank = _mel_filterbank(sr, n_fft)
    mel_spec = np.dot(power_spec, fbank.T)
    mel_spec = np.where(mel_spec == 0, np.finfo(float).eps, mel_spec)
    log_mel_spec = np.log(mel_spec)

    # DCT to get MFCCs
    mfccs = dct(log_mel_spec, type=2, axis=1, norm="ortho")[:, :n_mfcc]

    # Return mean across frames
    return np.mean(mfccs, axis=0)


def _load_wav_bytes(audio_bytes):
    """Load WAV audio from bytes, return (signal_array, sample_rate)."""
    with io.BytesIO(audio_bytes) as buf:
        with wave.open(buf, "rb") as wf:
            sr = wf.getframerate()
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            n_frames = wf.getnframes()
            raw = wf.readframes(n_frames)

    # Convert raw bytes to numpy array
    if sampwidth == 2:
        dtype = np.int16
    elif sampwidth == 4:
        dtype = np.int32
    elif sampwidth == 1:
        dtype = np.uint8
    else:
        dtype = np.int16

    data = np.frombuffer(raw, dtype=dtype).astype(np.float32)

    # Convert to mono if stereo
    if n_channels > 1:
        data = data.reshape(-1, n_channels).mean(axis=1)

    # Normalize to [-1, 1]
    if sampwidth == 1:
        data = (data - 128.0) / 128.0
    else:
        data = data / (2.0 ** (8 * sampwidth - 1))

    return data, sr


def _analyse_audio(audio_bytes: bytes) -> DroneDetectionResult:
    """Core spectral analysis logic. Accepts raw WAV bytes."""
    y, sr = _load_wav_bytes(audio_bytes)
    duration = float(len(y)) / sr

    # RMS energy
    rms = float(np.sqrt(np.mean(y ** 2)))

    # Compute averaged magnitude spectrum using STFT (multiple windows)
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

    # Energy in drone-characteristic band (100-500 Hz)
    band_mask = (freqs >= DRONE_FREQ_LOW) & (freqs <= DRONE_FREQ_HIGH)
    drone_band_energy = float(np.sum(fft_mag[band_mask] ** 2))
    total_energy = float(np.sum(fft_mag ** 2))
    drone_band_ratio = drone_band_energy / total_energy if total_energy > 0 else 0.0

    # Spectral centroid — exclude DC bin (index 0) to avoid pulling toward 0
    fft_mag_no_dc = fft_mag[1:]
    freqs_no_dc = freqs[1:]
    total_mag_no_dc = np.sum(fft_mag_no_dc)
    spectral_centroid = float(np.sum(freqs_no_dc * fft_mag_no_dc) / total_mag_no_dc) if total_mag_no_dc > 0 else 0.0

    # Dominant frequency — also exclude DC
    dominant_freq = float(freqs_no_dc[np.argmax(fft_mag_no_dc)])

    # MFCCs (first 5 coefficients, mean over time)
    mfcc_means = _compute_mfccs(y, sr, n_fft=n_fft, n_mfcc=N_MFCC)
    mfcc_list = [float(m) for m in mfcc_means]
    # Pad if needed
    while len(mfcc_list) < N_MFCC:
        mfcc_list.append(0.0)

    # --- ML-based classification ---
    # Assemble feature vector in the same order as training data
    feature_vector = np.array([[
        rms,
        drone_band_ratio,
        spectral_centroid,
        dominant_freq,
        mfcc_list[0],
        mfcc_list[1],
        mfcc_list[2],
        mfcc_list[3],
        mfcc_list[4],
    ]])

    # Predict class and probabilities
    predicted_label = int(_classifier.predict(feature_vector)[0])
    probabilities = _classifier.predict_proba(feature_vector)[0]

    classification = LABEL_MAP[predicted_label]
    confidence = float(probabilities[predicted_label])
    detected = (classification == "drone")

    return DroneDetectionResult(
        classification=classification,
        confidence=round(confidence, 4),
        drone_detected=detected,
        sample_rate=int(sr),
        duration_sec=round(duration, 3),
        total_rms_energy=round(rms, 6),
        drone_band_ratio=round(drone_band_ratio, 4),
        spectral_centroid_hz=round(spectral_centroid, 2),
        dominant_freq_hz=round(dominant_freq, 2),
        mfcc_0=round(mfcc_list[0], 2),
        mfcc_1=round(mfcc_list[1], 2),
        mfcc_4=round(mfcc_list[4], 2),
    )


@function(api_name="detectDroneFromAudio")
def detect_drone_from_audio(audio_base64: String) -> DroneDetectionResult:
    """Detect drone acoustic signature from base64-encoded WAV audio.

    Parameters
    ----------
    audio_base64 : str
        Base64-encoded WAV audio data captured from a microphone.

    Returns
    -------
    DroneDetectionResult
        Classification (drone/helicopter/background),
        confidence score, and extracted spectral features.
    """
    audio_bytes = base64.b64decode(audio_base64)
    return _analyse_audio(audio_bytes)
