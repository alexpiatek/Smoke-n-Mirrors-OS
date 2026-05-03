#!/usr/bin/env python
"""Python project setup script."""

import os
import sys
from setuptools import find_packages, setup

# Get the pipeline name override from environment variable or default to "root"
pipeline_name = os.environ.get("PIPELINE_OVERRIDE_UUID", "root")

setup(
    name=os.environ["PKG_NAME"],
    version=os.environ["PKG_VERSION"],
    description="Model training project",
    author="drew@hooperco.org",
    packages=find_packages(exclude=["contrib", "docs", "test"]),
    # Please specify your dependencies in conda_recipe/meta.yaml instead.
    install_requires=[],
    entry_points={
        "transforms.pipelines": [f"{pipeline_name} = main.pipeline:pipeline"]
    },
)
