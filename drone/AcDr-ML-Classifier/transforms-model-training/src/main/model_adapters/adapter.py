"""Model adapter for drone audio classification.

Wraps a trained scikit-learn classifier that predicts drone/helicopter/background
from spectral audio features.
"""
import palantir_models as pm
import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "total_rms_energy",
    "drone_band_ratio",
    "spectral_centroid_hz",
    "dominant_freq_hz",
    "mfcc_mean_0",
    "mfcc_mean_1",
    "mfcc_mean_2",
    "mfcc_mean_3",
    "mfcc_mean_4",
]

LABEL_MAP = {0: "background", 1: "drone", 2: "helicopter"}


class DroneClassifierAdapter(pm.ModelAdapter):
    """Adapter for the drone audio classification model."""

    @pm.auto_serialize()
    def __init__(self, model, label_encoder):
        self.model = model
        self.label_encoder = label_encoder

    @classmethod
    def api(cls):
        inputs = {
            "df_in": pm.Pandas(columns=[
                ("total_rms_energy", float),
                ("drone_band_ratio", float),
                ("spectral_centroid_hz", float),
                ("dominant_freq_hz", float),
                ("mfcc_mean_0", float),
                ("mfcc_mean_1", float),
                ("mfcc_mean_2", float),
                ("mfcc_mean_3", float),
                ("mfcc_mean_4", float),
            ])
        }
        outputs = {
            "df_out": pm.Pandas(columns=[
                ("total_rms_energy", float),
                ("drone_band_ratio", float),
                ("spectral_centroid_hz", float),
                ("dominant_freq_hz", float),
                ("mfcc_mean_0", float),
                ("mfcc_mean_1", float),
                ("mfcc_mean_2", float),
                ("mfcc_mean_3", float),
                ("mfcc_mean_4", float),
                ("predicted_label", int),
                ("predicted_class", str),
                ("confidence", float),
            ])
        }
        return inputs, outputs

    def predict(self, df_in):
        features = df_in[FEATURE_COLUMNS].values

        # Get predictions and probabilities
        predictions = self.model.predict(features)
        probabilities = self.model.predict_proba(features)

        df_out = df_in.copy()
        df_out["predicted_label"] = predictions
        df_out["predicted_class"] = [self.label_encoder.get(int(p), "unknown") for p in predictions]
        df_out["confidence"] = [float(probabilities[i, int(p)]) for i, p in enumerate(predictions)]

        return df_out
