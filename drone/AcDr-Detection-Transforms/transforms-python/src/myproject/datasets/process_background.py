"""Transform that reads the Hugging Face background (non-drone) audio samples
and runs the spectral analysis detection algorithm on each sample.
"""
from myproject.datasets.process_huggingface import _analyse_audio, RESULT_SCHEMA
from transforms.api import transform, Input, Output
import pyspark.sql.functions as F


OUTPUT_PATH = "/Users/drew@hooperco.org/AcDr Detection/background_detections"
BG_DATASET = "ri.foundry.main.dataset.e369cff4-b0ec-4417-8f2e-7ab20cd3ec56"


@transform.spark.using(
    bg_input=Input(BG_DATASET),
    detections_output=Output(OUTPUT_PATH),
)
def detect_background_samples(ctx, bg_input, detections_output):
    """Run drone detection on the Hugging Face background audio dataset."""
    df = bg_input.dataframe()

    df_with_audio = df.select(
        F.col("audio.path").alias("source_file"),
        F.col("audio.bytes").alias("audio_bytes"),
        F.col("label").alias("ground_truth_label"),
    )

    analyse_udf = F.udf(_analyse_audio, RESULT_SCHEMA)

    results_df = df_with_audio.withColumn(
        "analysis", analyse_udf(F.col("audio_bytes"))
    )

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
