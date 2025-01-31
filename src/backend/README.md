# Customer Success AI Platform - Backend Service

[![CI Status](https://github.com/customer-success-ai/backend/workflows/CI/badge.svg)](https://github.com/customer-success-ai/backend/actions)
[![Code Coverage](https://codecov.io/gh/customer-success-ai/backend/branch/main/graph/badge.svg)](https://codecov.io/gh/customer-success-ai/backend)
![Python Version](https://img.shields.io/badge/python-3.11%2B-blue.svg)

## Overview

The Customer Success AI Platform backend service provides a robust, scalable API layer for predictive analytics and customer success automation. Built with FastAPI and integrated with AWS SageMaker, this service powers intelligent customer health scoring, churn prediction, and automated intervention workflows.

### Key Features

- RESTful API with OpenAPI/Swagger documentation
- ML-powered predictive analytics pipeline
- Real-time customer health scoring
- Automated intervention workflows
- Secure multi-tenant architecture
- Horizontal scaling support
- Comprehensive monitoring and logging

## Prerequisites

- Python 3.11+
- Docker & Docker Compose
- Poetry package manager
- AWS account with SageMaker access
- PostgreSQL 15+
- Redis 7+

## Getting Started

### Environment Setup

```bash
# Clone the repository
git clone https://github.com/customer-success-ai/backend.git
cd backend

# Copy environment template
cp .env.example .env

# Install dependencies using Poetry
poetry install

# Initialize development database
docker-compose up -d db redis
poetry run alembic upgrade head

# Start development server
poetry run uvicorn app.main:app --reload
```

### Docker Development Environment

```bash
# Build and start all services
docker-compose up --build

# Run tests in container
docker-compose run --rm backend pytest

# Clean up containers
docker-compose down -v
```

## Project Structure

```
src/backend/
├── alembic/              # Database migrations
├── app/
│   ├── api/             # API endpoints
│   ├── core/            # Core functionality
│   ├── db/              # Database models
│   ├── ml/              # ML pipeline
│   ├── schemas/         # Pydantic models
│   └── services/        # Business logic
├── tests/               # Test suite
├── docker/              # Docker configurations
├── scripts/             # Utility scripts
├── .env.example         # Environment template
├── docker-compose.yml   # Docker services
├── pyproject.toml       # Dependencies
└── README.md           # This file
```

## Development

### Code Style

- Black for code formatting
- isort for import sorting
- flake8 for linting
- mypy for type checking

```bash
# Format code
poetry run black .
poetry run isort .

# Run linting
poetry run flake8
poetry run mypy .

# Run tests with coverage
poetry run pytest --cov
```

### Git Workflow

1. Create feature branch from `main`
2. Implement changes with tests
3. Run formatting and linting
4. Submit pull request
5. Pass CI checks and code review
6. Merge to `main`

## API Documentation

- OpenAPI documentation available at `/docs`
- ReDoc alternative at `/redoc`
- Comprehensive API tests in `tests/api/`

### Authentication

- OAuth2 with JWT tokens
- Role-based access control
- Rate limiting per endpoint

## ML Pipeline

### Model Training

- AWS SageMaker integration
- Automated feature engineering
- Model versioning and tracking
- A/B testing support

### Prediction Service

- Real-time inference endpoints
- Batch prediction jobs
- Model monitoring and drift detection
- Fallback strategies

## Deployment

### Production Setup

```bash
# Build production image
docker build -t customer-success-ai/backend:latest .

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### Infrastructure Requirements

- AWS ECS/EKS cluster
- RDS PostgreSQL (Multi-AZ)
- ElastiCache Redis cluster
- SageMaker endpoints
- Application Load Balancer
- CloudWatch monitoring

## Monitoring

### Logging

- Structured JSON logging
- Log aggregation with CloudWatch
- Error tracking with Sentry
- Request tracing with OpenTelemetry

### Metrics

- Prometheus metrics exposed at `/metrics`
- Grafana dashboards for visualization
- Custom business metrics tracking
- SLO/SLA monitoring

### Health Checks

- Readiness probe at `/health/ready`
- Liveness probe at `/health/live`
- Dependency health monitoring
- Custom health check endpoints

## Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Submit pull request
5. Follow code review process

## License

Copyright © 2024 Customer Success AI Platform. All rights reserved.