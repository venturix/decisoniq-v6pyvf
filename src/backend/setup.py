"""
Enterprise-grade setup configuration for Customer Success AI Platform backend service.
Handles package metadata, dependencies, and installation requirements with security considerations.

Dependencies:
setuptools==68.0.0 - Enterprise-grade build system
wheel==0.41.0 - Production-optimized package format
"""

import os
from setuptools import setup, find_packages  # setuptools v68.0.0

# Package metadata constants
PACKAGE_NAME = "customer-success-ai-platform"
VERSION = "1.0.0"
DESCRIPTION = "Enterprise-grade predictive analytics and automation solution for customer success with ML capabilities"
AUTHOR = "Blitzy Engineering Team"
PYTHON_REQUIRES = ">=3.11"
PACKAGE_CLASSIFIERS = [
    "Development Status :: 5 - Production/Stable",
    "Intended Audience :: Enterprise",
    "Operating System :: OS Independent",
    "Programming Language :: Python :: 3.11",
    "Topic :: Software Development :: Libraries :: Application Frameworks"
]

def read_requirements() -> list:
    """
    Reads and validates package requirements from requirements.txt with security checks.
    
    Returns:
        List[str]: List of validated package requirements with pinned versions
    
    Raises:
        FileNotFoundError: If requirements.txt is missing
        ValueError: If requirements format is invalid
    """
    requirements = []
    req_path = os.path.join(os.path.dirname(__file__), "requirements.txt")
    
    try:
        with open(req_path, "r", encoding="utf-8") as req_file:
            for line in req_file:
                # Skip comments and empty lines
                line = line.strip()
                if line and not line.startswith("#"):
                    # Validate requirement format
                    if "==" not in line:
                        raise ValueError(
                            f"Invalid requirement format: {line}. Must use pinned versions (==)"
                        )
                    requirements.append(line)
    except FileNotFoundError:
        raise FileNotFoundError(
            "requirements.txt not found. Required for production deployment."
        )
    
    return requirements

# Main setup configuration
setup(
    # Package identity
    name=PACKAGE_NAME,
    version=VERSION,
    description=DESCRIPTION,
    author=AUTHOR,
    
    # Python environment
    python_requires=PYTHON_REQUIRES,
    
    # Package structure
    package_dir={"": "src"},
    packages=find_packages(
        where="src",
        exclude=["tests*", "docs*"]
    ),
    
    # Data files and resources
    include_package_data=True,
    zip_safe=False,
    
    # Dependencies
    install_requires=read_requirements(),
    
    # Entry points
    entry_points={
        "console_scripts": [
            "cs-ai-platform=customer_success_ai_platform.cli:main"
        ]
    },
    
    # Package metadata
    classifiers=PACKAGE_CLASSIFIERS,
    
    # Build settings
    options={
        "bdist_wheel": {
            "universal": False  # Python 3 only package
        }
    }
)