"""Train a Random Forest classifier on combined drone audio datasets.

Combines features from:
1. Original DroneDetectionThesis dataset (90 samples: drone/helicopter/background)
2. HuggingFace drone samples (4,623 samples)
3. HuggingFace background samples (100 samples)

Labels:
  0 = background
  1 = drone
  2 = helicopter
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import classification_report, accuracy_score

from transforms.api import Input, lightweight, transform
from palantir_models.transforms import ModelOutput
from main.model_adapters.adapter import DroneClassifierAdapter, FEATURE_COLUMNS


LABEL_MAP = {0: "background", 1: "drone", 2: "helicopter"}

# Dataset paths
ORIGINAL_DATASET = "ri.foundry.main.dataset.379a1907-7402-4a67-9963-9a52638da052"
HF_DRONE_DATASET = "ri.foundry.main.dataset.4d5e9d61-00fd-4eca-a696-9d00df591845"
HF_BG_DATASET = "ri.foundry.main.dataset.88e809d4-bff9-4518-8284-a4136dc39e25"


def prepare_original_data(df):
    """Map original dataset labels to numeric: drone=1, helicopter=2, background=0."""
    df = df[FEATURE_COLUMNS + ["source_file"]].copy()
    df["label"] = df["source_file"].apply(
        lambda x: 1 if x.startswith("DRONE") else (2 if x.startswith("HELICOPTER") else 0)
    )
    return df[FEATURE_COLUMNS + ["label"]].dropna()


def prepare_hf_drone_data(df):
    """HuggingFace drone dataset: all label=1."""
    df = df[FEATURE_COLUMNS].copy()
    df["label"] = 1
    return df.dropna()


def prepare_hf_bg_data(df):
    """HuggingFace background dataset: all label=0."""
    df = df[FEATURE_COLUMNS].copy()
    df["label"] = 0
    return df.dropna()


@lightweight
@transform(
    original_input=Input(ORIGINAL_DATASET),
    hf_drone_input=Input(HF_DRONE_DATASET),
    hf_bg_input=Input(HF_BG_DATASET),
    model_output=ModelOutput("/Users/drew@hooperco.org/AcDr Detection/drone_classifier_model"),
)
def compute(original_input, hf_drone_input, hf_bg_input, model_output):
    """Train the drone audio classifier."""

    # Load and prepare all datasets
    original_df = prepare_original_data(original_input.pandas())
    hf_drone_df = prepare_hf_drone_data(hf_drone_input.pandas())
    hf_bg_df = prepare_hf_bg_data(hf_bg_input.pandas())

    # Combine all datasets
    combined_df = pd.concat([original_df, hf_drone_df, hf_bg_df], ignore_index=True)

    # Create experiment
    experiment = model_output.create_experiment("drone-classifier-training")

    # Log dataset composition
    experiment.log_param("total_samples", len(combined_df))
    experiment.log_param("drone_samples", int((combined_df["label"] == 1).sum()))
    experiment.log_param("background_samples", int((combined_df["label"] == 0).sum()))
    experiment.log_param("helicopter_samples", int((combined_df["label"] == 2).sum()))
    experiment.log_param("features", str(FEATURE_COLUMNS))

    # Split features and labels
    X = combined_df[FEATURE_COLUMNS].values
    y = combined_df["label"].values

    # Train/test split (stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Train Gradient Boosted Classifier
    params = {
        "n_estimators": 200,
        "max_depth": 6,
        "learning_rate": 0.1,
        "min_samples_leaf": 5,
        "subsample": 0.8,
        "random_state": 42,
    }
    experiment.log_params(params)

    model = GradientBoostingClassifier(**params)
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    experiment.log_metric("accuracy", accuracy, step=0)

    # Per-class metrics
    report = classification_report(y_test, y_pred, target_names=["background", "drone", "helicopter"], output_dict=True)
    for class_name in ["background", "drone", "helicopter"]:
        experiment.log_metric(f"precision/{class_name}", report[class_name]["precision"], step=0)
        experiment.log_metric(f"recall/{class_name}", report[class_name]["recall"], step=0)
        experiment.log_metric(f"f1/{class_name}", report[class_name]["f1-score"], step=0)

    # Cross-validation
    cv_scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")
    experiment.log_metric("cv_accuracy_mean", float(np.mean(cv_scores)), step=0)
    experiment.log_metric("cv_accuracy_std", float(np.std(cv_scores)), step=0)

    # Feature importance
    importances = model.feature_importances_
    importance_df = pd.DataFrame({
        "feature": FEATURE_COLUMNS,
        "importance": importances
    }).sort_values("importance", ascending=False)
    experiment.log_table("feature_importance", importance_df)

    # Log evaluation results table
    eval_df = pd.DataFrame({
        "class": ["background", "drone", "helicopter"],
        "precision": [report[c]["precision"] for c in ["background", "drone", "helicopter"]],
        "recall": [report[c]["recall"] for c in ["background", "drone", "helicopter"]],
        "f1_score": [report[c]["f1-score"] for c in ["background", "drone", "helicopter"]],
        "support": [report[c]["support"] for c in ["background", "drone", "helicopter"]],
    })
    experiment.log_table("classification_report", eval_df)

    # Publish model
    label_encoder = LABEL_MAP
    adapter = DroneClassifierAdapter(model, label_encoder)
    model_output.publish(model_adapter=adapter, experiment=experiment)
