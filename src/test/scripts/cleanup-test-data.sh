#!/usr/bin/env bash

# cleanup-test-data.sh
# Version: 1.0.0
# Dependencies:
# - postgresql-client v15.x
# - aws-cli v2.x
# - redis-tools v7.x

set -euo pipefail
IFS=$'\n\t'

# Environment variables with defaults
TEST_ENV="${TEST_ENV:-'test'}"
DB_HOST="${DB_HOST:-'localhost'}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-'cs_platform_test'}"
REDIS_HOST="${REDIS_HOST:-'localhost'}"
REDIS_PORT="${REDIS_PORT:-6379}"
CLEANUP_TIMEOUT="${CLEANUP_TIMEOUT:-3600}"
DRY_RUN="${DRY_RUN:-false}"
PARALLEL_CLEANUP="${PARALLEL_CLEANUP:-true}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"

# Logging setup
setup_logging() {
    local log_level="${1:-INFO}"
    exec 3>&1 # Save stdout to fd 3 for logging
    
    log() {
        local level="$1"
        local message="$2"
        local timestamp
        timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        printf "[%s] %s - %s\n" "$timestamp" "$level" "$message" >&3
    }
    
    INFO() { [[ $LOG_LEVEL == "INFO" || $LOG_LEVEL == "DEBUG" ]] && log "INFO" "$1"; }
    ERROR() { log "ERROR" "$1" >&2; }
    DEBUG() { [[ $LOG_LEVEL == "DEBUG" ]] && log "DEBUG" "$1"; }
}

# Validation function
validate_environment() {
    INFO "Validating environment configuration..."
    
    # Check required environment variables
    local required_vars=("TEST_ENV" "DB_HOST" "DB_PORT" "DB_NAME" "REDIS_HOST" "REDIS_PORT")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            ERROR "Required environment variable $var is not set"
            return 1
        fi
    done
    
    # Validate database connection
    if ! PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c '\q' >/dev/null 2>&1; then
        ERROR "Failed to connect to database"
        return 1
    fi
    
    # Validate AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        ERROR "Invalid AWS credentials"
        return 1
    }
    
    # Validate Redis connection
    if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
        ERROR "Failed to connect to Redis"
        return 1
    }
    
    INFO "Environment validation successful"
    return 0
}

# Database cleanup function
cleanup_database() {
    INFO "Starting database cleanup..."
    
    local tables=(
        "customer_test_data"
        "risk_assessment_test_data"
        "playbook_test_data"
        "metrics_test_data"
    )
    
    # Begin transaction
    PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" <<-EOF
        BEGIN;
        SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
        
        -- Disable triggers temporarily
        SET session_replication_role = 'replica';
        
        $(for table in "${tables[@]}"; do
            echo "TRUNCATE TABLE $table CASCADE;"
        done)
        
        -- Reset sequences
        SELECT setval(c.oid, 1, false)
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'S' AND n.nspname = 'public';
        
        -- Re-enable triggers
        SET session_replication_role = 'origin';
        
        COMMIT;
EOF
    
    local exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
        INFO "Database cleanup completed successfully"
    else
        ERROR "Database cleanup failed with exit code $exit_code"
    fi
    return $exit_code
}

# Cache cleanup function
cleanup_cache() {
    INFO "Starting Redis cache cleanup..."
    
    local patterns=(
        "test:*"
        "test_session:*"
        "test_metrics:*"
    )
    
    for pattern in "${patterns[@]}"; do
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --scan --pattern "$pattern" | while read -r key; do
            if [[ $DRY_RUN == "false" ]]; then
                redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" DEL "$key" >/dev/null
            fi
            DEBUG "Deleted cache key: $key"
        done
    done
    
    INFO "Cache cleanup completed"
    return 0
}

# S3 cleanup function
cleanup_s3() {
    INFO "Starting S3 cleanup..."
    
    local buckets=(
        "cs-platform-test-models"
        "cs-platform-test-data"
        "cs-platform-test-reports"
    )
    
    for bucket in "${buckets[@]}"; do
        if [[ $DRY_RUN == "false" ]]; then
            aws s3 rm "s3://$bucket/test/" --recursive --quiet
        fi
        DEBUG "Cleaned up S3 bucket: $bucket"
    done
    
    INFO "S3 cleanup completed"
    return 0
}

# SageMaker cleanup function
cleanup_sagemaker() {
    INFO "Starting SageMaker cleanup..."
    
    # Delete test endpoints
    aws sagemaker list-endpoints --name-contains "test-" --query 'Endpoints[*].EndpointName' --output text | \
    while read -r endpoint; do
        if [[ $DRY_RUN == "false" ]]; then
            aws sagemaker delete-endpoint --endpoint-name "$endpoint"
        fi
        DEBUG "Deleted endpoint: $endpoint"
    done
    
    # Delete test models
    aws sagemaker list-models --name-contains "test-" --query 'Models[*].ModelName' --output text | \
    while read -r model; do
        if [[ $DRY_RUN == "false" ]]; then
            aws sagemaker delete-model --model-name "$model"
        fi
        DEBUG "Deleted model: $model"
    done
    
    INFO "SageMaker cleanup completed"
    return 0
}

# Main execution function
main() {
    setup_logging "$LOG_LEVEL"
    
    # Trap signals for cleanup
    trap 'ERROR "Script interrupted"; exit 1' INT TERM
    
    INFO "Starting test data cleanup process..."
    INFO "Environment: $TEST_ENV"
    [[ $DRY_RUN == "true" ]] && INFO "Running in DRY RUN mode"
    
    # Validate environment
    if ! validate_environment; then
        ERROR "Environment validation failed"
        exit 1
    fi
    
    # Execute cleanup functions
    if [[ $PARALLEL_CLEANUP == "true" ]]; then
        cleanup_database & pid_db=$!
        cleanup_cache & pid_cache=$!
        cleanup_s3 & pid_s3=$!
        cleanup_sagemaker & pid_sm=$!
        
        # Wait for all processes with timeout
        if ! wait -n "$pid_db" "$pid_cache" "$pid_s3" "$pid_sm"; then
            ERROR "One or more cleanup processes failed"
            exit 1
        fi
    else
        cleanup_database && \
        cleanup_cache && \
        cleanup_s3 && \
        cleanup_sagemaker
    fi
    
    INFO "Test data cleanup completed successfully"
    return 0
}

# Execute main function
main "$@"