from transforms.api import Pipeline

from main import model_training


pipeline = Pipeline()
pipeline.discover_transforms(model_training)
