#!/bin/bash

# setup-test-env.sh
# Version: 1.0.0
# Description: Sets up and configures the test environment for the Customer Success AI Platform
# Dependencies:
# - docker-compose v2.20+
# - aws-cli v2.13+
# - jq v1.6+
# - k6 v0.45+

# Exit on any error
set -e

# Global variables
SCRIPT_DIR=$(dirname "${BASH_SOURCE[0]}")
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)
TEST_ENV_FILE="$PROJECT_ROOT/src/test/.env"
LOG_DIR="$PROJECT_ROOT/src/test/logs"
RESOURCE_LIMITS_CPU="2"
RESOURCE_LIMITS_MEMORY="4g"
RESOURCE_LIMITS_STORAGE="10g"
TIMEOUT_SECONDS=300
HEALTH_CHECK_INTERVAL=5

# Logging configuration
setup_logging() {
    mkdir -p "$LOG_DIR"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    exec 1> >(tee -a "${LOG_DIR}/setup_${timestamp}.log")
    exec 2> >(tee -a "${LOG_DIR}/setup_${timestamp}.error.log")
}

# Environment setup function
setup_environment() {
    echo "Setting up test environment..."
    
    # Create and validate environment file
    if [[ ! -f "$TEST_ENV_FILE" ]]; then
        cp "$PROJECT_ROOT/src/test/.env.example" "$TEST_ENV_FILE"
        chmod 600 "$TEST_ENV_FILE"
    fi

    # Configure test database
    cat >> "$TEST_ENV_FILE" << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cs_ai_test
DB_USER=test_user
DB_PASSWORD=$(openssl rand -base64 32)
DB_SSL_MODE=require

# AWS Test Configuration
AWS_DEFAULT_REGION=us-east-1
AWS_ACCESS_KEY_ID=test-key
AWS_SECRET_ACCESS_KEY=test-secret

# Performance Test Thresholds
PERFORMANCE_TEST_VUS=10
PERFORMANCE_TEST_DURATION=30s
PERFORMANCE_TEST_MAX_RESPONSE_TIME=3000

# Resource Limits
RESOURCE_LIMITS_CPU=$RESOURCE_LIMITS_CPU
RESOURCE_LIMITS_MEMORY=$RESOURCE_LIMITS_MEMORY
RESOURCE_LIMITS_STORAGE=$RESOURCE_LIMITS_STORAGE

# Monitoring Configuration
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
INFLUXDB_PORT=8086
EOF
}

# Dependencies setup function
setup_test_dependencies() {
    echo "Setting up test dependencies..."

    # Verify required tools
    local required_tools=("docker-compose" "aws" "jq" "k6")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            echo "Error: $tool is required but not installed."
            exit 1
        fi
    done

    # Create Docker test network
    docker network create cs-ai-test-network 2>/dev/null || true

    # Pull required Docker images in parallel
    echo "Pulling Docker images..."
    {
        docker pull postgres:15-alpine &
        docker pull redis:7-alpine &
        docker pull grafana/grafana:latest &
        docker pull prom/prometheus:latest &
        docker pull influxdb:latest &
        wait
    }

    # Create test volumes
    docker volume create cs-ai-test-db-data
    docker volume create cs-ai-test-redis-data
    docker volume create cs-ai-test-prometheus-data
    docker volume create cs-ai-test-grafana-data
}

# Initialize test services
initialize_test_services() {
    echo "Initializing test services..."

    # Start core services with docker-compose
    docker-compose -f "$PROJECT_ROOT/src/test/docker-compose.test.yml" up -d

    # Wait for services to be healthy
    local services=("postgres" "redis" "prometheus" "grafana")
    for service in "${services[@]}"; do
        wait_for_service "$service"
    done

    # Initialize test database
    echo "Initializing test database..."
    docker-compose -f "$PROJECT_ROOT/src/test/docker-compose.test.yml" \
        exec -T postgres psql -U test_user -d cs_ai_test -c "SELECT 1"

    # Configure AWS test resources
    echo "Configuring AWS test resources..."
    aws configure set aws_access_key_id "test-key" --profile cs-ai-test
    aws configure set aws_secret_access_key "test-secret" --profile cs-ai-test
    aws configure set region "us-east-1" --profile cs-ai-test
}

# Wait for service health check
wait_for_service() {
    local service=$1
    local retries=$((TIMEOUT_SECONDS / HEALTH_CHECK_INTERVAL))
    local count=0

    echo "Waiting for $service to be ready..."
    while [ $count -lt $retries ]; do
        if docker-compose -f "$PROJECT_ROOT/src/test/docker-compose.test.yml" ps "$service" | grep -q "Up"; then
            echo "$service is ready"
            return 0
        fi
        count=$((count + 1))
        sleep $HEALTH_CHECK_INTERVAL
    done

    echo "Error: $service failed to start within $TIMEOUT_SECONDS seconds"
    return 1
}

# Cleanup function
cleanup_resources() {
    echo "Cleaning up test resources..."

    # Stop services
    docker-compose -f "$PROJECT_ROOT/src/test/docker-compose.test.yml" down -v

    # Remove test network
    docker network rm cs-ai-test-network 2>/dev/null || true

    # Archive logs
    local archive_dir="${LOG_DIR}/archive"
    mkdir -p "$archive_dir"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    tar -czf "${archive_dir}/logs_${timestamp}.tar.gz" -C "$LOG_DIR" .

    # Clean up AWS test profile
    aws configure --profile cs-ai-test --region us-east-1 
}

# Main execution function
main() {
    # Set up error handling
    trap cleanup_resources EXIT

    # Initialize logging
    setup_logging

    echo "Starting test environment setup..."

    # Execute setup steps
    setup_environment
    setup_test_dependencies
    initialize_test_services

    echo "Test environment setup completed successfully"
    echo "Monitoring dashboard available at: http://localhost:3000"
    echo "Prometheus metrics available at: http://localhost:9090"
}

# Execute main function
main "$@"