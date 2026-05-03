# Foundry Modeling
This template provides the structure for training a model in Foundry.
To train a model in Foundry, you will need to implement two components:
1. Logic to train a **model** in Foundry
2. A **ModelAdapter** - this is the logic that describes how Foundry can interact with the **model** for serialization and inference

A model trained in Foundry can be saved natively as a resource that can be used in:
- the Modeling Objectives application for evaluation and deployment to a REST API or batch deployment environment
- the model itself as a standalone live deployment
- downstream inference transforms
- functions
- further training or transfer learning to a different application
***
### Saving a trained model in Foundry
Models can be saved to `ModelOutput` with the `publish` method.
```python
from transforms.api import lightweight, transform, Input
from palantir_models.transforms import ModelOutput
from model_adapter.example_adapter import ExampleModelAdapter           # This is the ModelAdapter implemented in this repository
@lightweight
@transform(
    training_data_input=Input("/path/to/training_data"),
    model_output=ModelOutput("/path/to/model")
)
def compute(training_data_input, model_output):
    trained_model = train_model(training_data_input.pandas())           # 1. Train the model in a python transform
                                                                        #    You implement #train_model with your custom training logic
    wrapped_model = ExampleModelAdapter(trained_model)                  # 2. Wrap the trained model in a ModelAdapter
    model_output.publish(                                               # 3. Save the wrapped model to Foundry
        model_adapter=wrapped_model                                     #    Foundry will call ModelAdapter.save
    )
```
***
### Running Inference in Python Transforms
To use a model in python transforms, all you need to do is import the model as an input. In this example, the ModelInput will run as a sidecar container, and the provided adapter will ensure requests are sent properly to the sidecar. The model can also be loaded into the python environment itself my removing `use_sidecar` argument or setting it to `False`. takes one tabular input named `input_df` and produces one tabular output named `output_df`.
```python
from transforms.api import lightweight, transform, Input, Output
from palantir_models.transforms import ModelInput
@lightweight
@transform(
    inference_input=Input("/path/to/inference_input"),
    inference_output=Output("/path/to/inference_output"),
    model_input=ModelInput(
        "/path/to/model",
        use_sidecar=True,
        sidecar_resources={
            "cpus": 2.0,
            "memory_gb": 4.0,
        }
    ),
)
def compute(inference_input, model_input, inference_output):             
    inference_results = model_input.transform(inference_input.pandas())  # 1. Call ModelAdapter.transform with the inputs specified in ModelAdapter.api
                                                                         # Inference results will be the returned as a named tuple of outputs from ModelAdapter.run_inference
    inference_output.write_pandas(inference_results.output_df)           # 2. Collect the desired output from the named tuple of inference result outputs and 
                                                                         # write model inference results back to Foundry
```
[Refer to the full ModelInput documentation to learn more](/docs/foundry/integrate-models/transform-model-input).
***
### ModelAdapter Implementation
In the `adapter.py` file, you can implement the logic for a custom model adapter. The custom model adapter can be directly consumed in this repository.
Full [documentation](/docs/foundry/model-integration/tutorial-train-code-repositories/) and [API defintion](/docs/foundry/integrate-models/model-adapter-reference/) are available in the documentation.
```python
import palantir_models as pm


class ExampleModelAdapter(pm.ModelAdapter):

    @pm.auto_serialize(
        # TODO: Fill in the model constructor and define parameter serialization.
        model=pm.serializers.DillSerializer(),
        config=pm.serializers.JsonSerializer()
    )
    def __init__(self, model, config):
        self.model = model
        self.config = config

    @classmethod
    def api(cls):
        # TODO: Edit this method to define the model API.
        inputs = {
            "df_in": pm.Pandas(columns=[("input_column", str)]),
            "param_in": pm.Parameter(type=str, default="default_value")
        }
        outputs = {
            "df_out": pm.Pandas(columns=[("output_column", str)])
        }
        return inputs, outputs

    def predict(self, df_in, param_in):
        # Input signature should match inputs defined in api()
        # Return type should match the output type defined in api()

        # TODO: Apply custom inference logic    
        return df_in
```
