"""Batch inference: run the trained drone classifier on all input datasets combined.

Combines all 3 detection datasets, runs the model, and outputs predictions
alongside ground truth labels for evaluation.
"""
import pandas as pd

from transforms.api import Input, Output, lightweight, transform
from palantir_models.transforms import ModelInput

from main.model_adapters.adapter import FEATURE_COLUMNS


# Dataset RIDs
ORIGINAL_DATASET = "ri.foundry.main.dataset.379a1907-7402-4a67-9963-9a52638da052"
HF_DRONE_DATASET = "ri.foundry.main.dataset.4d5e9d61-00fd-4eca-a696-9d00df591845"
HF_BG_DATASET = "ri.foundry.main.dataset.88e809d4-bff9-4518-8284-a4136dc39e25"
MODEL_PATH = "/Users/drew@hooperco.org/AcDr Detection/drone_classifier_model"
OUTPUT_PATH = "/Users/drew@hooperco.org/AcDr Detection/ml_batch_predictions"


def prepare_original_labels(df):
    """Map original dataset labels from source_file prefix: DRONE_->1, HELICOPTER_->2, BACKGROUND_->0."""
    df = df[FEATURE_COLUMNS + ["source_file"]].copy()
    df["ground_truth_label"] = df["source_file"].apply(
        lambda x: 1 if x.startswith("DRONE") else (2 if x.startswith("HELICOPTER") else 0)
    )
    return df[FEATURE_COLUMNS + ["ground_truth_label"]].dropna()


def prepare_hf_drone(df):
    """HuggingFace drone dataset: ground_truth_label=1."""
    df = df[FEATURE_COLUMNS + ["ground_truth_label"]].copy()
    df["ground_truth_label"] = 1
    return df.dropna()


def prepare_hf_bg(df):
    """HuggingFace background dataset: ground_truth_label=0."""
    df = df[FEATURE_COLUMNS + ["ground_truth_label"]].copy()
    df["ground_truth_label"] = 0
    return df.dropna()


@lightweight
@transform(
    original_input=Input(ORIGINAL_DATASET),
    hf_drone_input=Input(HF_DRONE_DATASET),
    hf_bg_input=Input(HF_BG_DATASET),
    model=ModelInput(MODEL_PATH, use_sidecar=False),
    out=Output(OUTPUT_PATH),
)
def compute(original_input, hf_drone_input, hf_bg_input, model, out):
    """Run batch inference on all combined datasets and output predictions vs ground truth."""

    # Load and prepare each dataset with ground truth labels
    original_df = prepare_original_labels(original_input.pandas())
    hf_drone_df = prepare_hf_drone(hf_drone_input.pandas())
    hf_bg_df = prepare_hf_bg(hf_bg_input.pandas())

    # Combine all datasets
    combined_df = pd.concat([original_df, hf_drone_df, hf_bg_df], ignore_index=True)

    # Extract ground truth before inference
    ground_truth = combined_df["ground_truth_label"].values

    # Prepare features for model input
    features_df = combined_df[FEATURE_COLUMNS].copy()

    # Run model inference
    result = model.transform(features_df)
    predictions_df = result.df_out

    # Add ground truth to predictions output
    predictions_df["ground_truth_label"] = ground_truth

    # Select output columns
    output_columns = FEATURE_COLUMNS + [
        "ground_truth_label",
        "predicted_label",
        "predicted_class",
        "confidence",
    ]
    output_df = predictions_df[output_columns]

    out.write_pandas(output_df)
