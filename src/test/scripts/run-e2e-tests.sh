#!/bin/bash

# Enterprise-grade E2E test execution script for Customer Success AI Platform
# Version: 1.0.0
# Supports parallel test execution, performance monitoring, and comprehensive reporting

set -euo pipefail

# Default configuration with production-grade thresholds
TEST_ENV="${TEST_ENV:-local}"
BROWSER="${BROWSER:-chromium}"
HEADED="${HEADED:-false}"
WORKERS="${WORKERS:-4}"
RETRIES="${RETRIES:-2}"
PERFORMANCE_THRESHOLD="${PERFORMANCE_THRESHOLD:-3000}"
CONCURRENT_USERS="${CONCURRENT_USERS:-200}"
EVENT_PROCESSING_RATE="${EVENT_PROCESSING_RATE:-100000}"

# Test artifact directories
ARTIFACTS_DIR="test-results"
REPORT_DIR="$ARTIFACTS_DIR/reports"
SCREENSHOT_DIR="$ARTIFACTS_DIR/screenshots"
VIDEO_DIR="$ARTIFACTS_DIR/videos"
TRACE_DIR="$ARTIFACTS_DIR/traces"
PERFORMANCE_DIR="$ARTIFACTS_DIR/performance"

# Color codes for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging utility function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}"
}

# Check required dependencies and their versions
check_dependencies() {
    log "INFO" "Checking required dependencies..."

    # Check Node.js version (>= 16.x required)
    if ! command -v node &> /dev/null; then
        log "ERROR" "Node.js is not installed"
        return 1
    fi
    
    local node_version=$(node -v | cut -d 'v' -f 2)
    if [[ $(echo "$node_version 16.0.0" | tr " " "\n" | sort -V | head -n 1) != "16.0.0" ]]; then
        log "ERROR" "Node.js version >= 16.0.0 is required"
        return 1
    fi

    # Check npm version (>= 8.x required)
    if ! command -v npm &> /dev/null; then
        log "ERROR" "npm is not installed"
        return 1
    }

    # Verify Playwright installation
    if ! npx playwright --version &> /dev/null; then
        log "ERROR" "Playwright is not installed"
        return 1
    }

    # Check browser installations
    npx playwright install chromium firefox webkit

    # Verify system resources
    local memory=$(free -g | awk '/^Mem:/{print $2}')
    if [[ $memory -lt 4 ]]; then
        log "WARNING" "Minimum 4GB RAM recommended for optimal performance"
    }

    local cpu_cores=$(nproc)
    if [[ $cpu_cores -lt 2 ]]; then
        log "WARNING" "Multiple CPU cores recommended for parallel execution"
    }

    # Check disk space
    local free_space=$(df -h . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $free_space -lt 10 ]]; then
        log "WARNING" "Low disk space. At least 10GB recommended"
    }

    log "INFO" "Dependency checks completed successfully"
    return 0
}

# Setup test environment with performance monitoring
setup_environment() {
    local env=$1
    log "INFO" "Setting up test environment: $env"

    # Create required directories
    mkdir -p "$ARTIFACTS_DIR" "$REPORT_DIR" "$SCREENSHOT_DIR" "$VIDEO_DIR" "$TRACE_DIR" "$PERFORMANCE_DIR"

    # Initialize performance monitoring
    if [[ $env != "ci" ]]; then
        log "INFO" "Initializing performance monitoring..."
        # Start resource monitoring in background
        top -b -n 1 > "$PERFORMANCE_DIR/resources_before.txt"
    fi

    # Configure environment-specific settings
    case $env in
        "local")
            export NODE_ENV="development"
            export LOG_LEVEL="debug"
            ;;
        "staging")
            export NODE_ENV="staging"
            export LOG_LEVEL="info"
            ;;
        "ci")
            export NODE_ENV="test"
            export LOG_LEVEL="error"
            ;;
        *)
            log "ERROR" "Invalid environment: $env"
            return 1
            ;;
    esac

    # Validate environment configuration
    if [[ ! -f ".env.$env" ]]; then
        log "ERROR" "Environment configuration file .env.$env not found"
        return 1
    fi

    log "INFO" "Environment setup completed"
    return 0
}

# Execute Playwright tests with performance validation
run_tests() {
    local browser=$1
    local headed=$2
    local workers=$3

    log "INFO" "Starting test execution with configuration:"
    log "INFO" "Browser: $browser"
    log "INFO" "Headed mode: $headed"
    log "INFO" "Workers: $workers"

    # Set test execution environment variables
    export PLAYWRIGHT_BROWSERS_PATH="0"
    export PLAYWRIGHT_JSON_OUTPUT_NAME="$REPORT_DIR/results.json"
    export PWDEBUG="${headed}"

    # Build test execution command
    local test_command="npx playwright test"
    test_command+=" --browser $browser"
    test_command+=" --workers $workers"
    test_command+=" --retries $RETRIES"
    test_command+=" --reporter=list,html,junit"
    test_command+=" --config=playwright.config.ts"

    if [[ $headed == "true" ]]; then
        test_command+=" --headed"
    fi

    # Execute tests with performance monitoring
    local start_time=$(date +%s)
    local test_output
    local test_status=0

    test_output=$(eval "$test_command" 2>&1) || test_status=$?

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Validate performance requirements
    if [[ $duration -gt $PERFORMANCE_THRESHOLD ]]; then
        log "WARNING" "Test execution exceeded performance threshold: ${duration}s > ${PERFORMANCE_THRESHOLD}s"
    fi

    # Store test output and performance metrics
    echo "$test_output" > "$REPORT_DIR/test_output.log"
    echo "Duration: ${duration}s" > "$PERFORMANCE_DIR/execution_metrics.txt"
    echo "Status: $test_status" >> "$PERFORMANCE_DIR/execution_metrics.txt"

    return $test_status
}

# Generate comprehensive test report
generate_report() {
    log "INFO" "Generating test execution report..."

    # Collect test results
    local total_tests=$(grep -c "test" "$REPORT_DIR/test_output.log" || echo "0")
    local passed_tests=$(grep -c "ok" "$REPORT_DIR/test_output.log" || echo "0")
    local failed_tests=$(grep -c "failed" "$REPORT_DIR/test_output.log" || echo "0")

    # Generate HTML report
    npx playwright show-report "$REPORT_DIR"

    # Create summary report
    cat << EOF > "$REPORT_DIR/summary.txt"
Test Execution Summary
---------------------
Total Tests: $total_tests
Passed: $passed_tests
Failed: $failed_tests
Duration: $(cat "$PERFORMANCE_DIR/execution_metrics.txt" | grep Duration)
Environment: $TEST_ENV
Browser: $BROWSER
Workers: $WORKERS
EOF

    # Archive test artifacts
    local archive_name="test-artifacts-$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$ARTIFACTS_DIR/$archive_name" \
        "$REPORT_DIR" \
        "$SCREENSHOT_DIR" \
        "$VIDEO_DIR" \
        "$TRACE_DIR" \
        "$PERFORMANCE_DIR"

    log "INFO" "Test report generated: $REPORT_DIR/summary.txt"
    log "INFO" "Test artifacts archived: $ARTIFACTS_DIR/$archive_name"
}

# Main execution flow
main() {
    log "INFO" "Starting E2E test execution"

    # Check dependencies
    if ! check_dependencies; then
        log "ERROR" "Dependency check failed"
        exit 1
    fi

    # Setup environment
    if ! setup_environment "$TEST_ENV"; then
        log "ERROR" "Environment setup failed"
        exit 1
    fi

    # Execute tests
    if ! run_tests "$BROWSER" "$HEADED" "$WORKERS"; then
        log "ERROR" "Test execution failed"
        generate_report
        exit 1
    fi

    # Generate report
    generate_report

    log "INFO" "E2E test execution completed successfully"
    exit 0
}

# Script entry point
main "$@"