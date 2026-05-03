"""
Edit this file to specify where to search for ModelAdapters in this repository to be registered.
By default, the `model_adapters` directory is specified as the root directory in which ModelAdapters are defined.
"""
#  (c) Copyright 2024 Palantir Technologies Inc. All rights reserved.

from palantir_models.manifest.model_adapter_discovery import ModelAdapterDiscovery
from main import model_adapters

adapter_discovery = ModelAdapterDiscovery()
adapter_discovery.discover_in_modules(model_adapters)
