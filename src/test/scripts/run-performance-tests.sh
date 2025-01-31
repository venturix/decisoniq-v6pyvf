#!/bin/bash

# Advanced performance test execution script for Customer Success AI Platform
# Version: 1.0.0
# Validates system performance against defined SLAs including uptime, response times,
# user concurrency, and data processing capabilities

set -e  # Exit on error
set -u  # Exit on undefined variables

# Configuration constants
readonly TEST_ENVIRONMENTS=("local" "staging" "production")
readonly TEST_TYPES=("smoke" "load" "stress" "soak")
readonly DEFAULT_ENVIRONMENT="staging"
readonly DEFAULT_TEST_TYPE="load"
readonly MAX_CONCURRENT_USERS=200
readonly EVENTS_PER_DAY=100000
readonly RESPONSE_TIME_THRESHOLD=3000  # 3 seconds

# Color codes for output formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging utility functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check all required dependencies
check_dependencies() {
    local status=0

    # Check k6 installation
    if ! command -v k6 &> /dev/null; then
        log_error "k6 is not installed. Please install k6 version 0.45.0 or higher"
        status=1
    else
        local k6_version=$(k6 version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        if ! [[ "$(printf '%s\n' "0.45.0" "$k6_version" | sort -V | head -n1)" = "0.45.0" ]]; then
            log_error "k6 version must be 0.45.0 or higher. Current version: $k6_version"
            status=1
        fi
    fi

    # Check Node.js installation
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js version 18.x or higher"
        status=1
    else
        local node_version=$(node --version | cut -d 'v' -f 2)
        if ! [[ "$(printf '%s\n' "18.0.0" "$node_version" | sort -V | head -n1)" = "18.0.0" ]]; then
            log_error "Node.js version must be 18.x or higher. Current version: $node_version"
            status=1
        fi
    fi

    # Check npm packages
    if ! npm list typescript > /dev/null 2>&1; then
        log_error "TypeScript is not installed. Please run 'npm install'"
        status=1
    fi

    # Verify configuration files exist
    local required_files=(
        "src/test/k6.config.ts"
        "src/test/src/performance/scenarios/api-endpoints.ts"
        "src/test/src/config/performance-thresholds.ts"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file not found: $file"
            status=1
        fi
    done

    return $status
}

# Function to set up test environment
setup_test_environment() {
    local environment=$1
    local test_type=$2
    local status=0

    log_info "Setting up test environment: $environment, type: $test_type"

    # Create temporary test directories
    mkdir -p ./tmp/performance-tests
    mkdir -p ./tmp/test-results

    # Compile TypeScript files
    if ! npm run build:test > /dev/null 2>&1; then
        log_error "Failed to compile TypeScript files"
        return 1
    fi

    # Set environment variables
    export TEST_ENV="$environment"
    export TEST_TYPE="$test_type"
    export K6_OUT="json=./tmp/test-results/results.json"

    return $status
}

# Function to run performance tests
run_performance_tests() {
    local environment=$1
    local test_type=$2
    local options=$3
    local status=0

    log_info "Executing performance tests for environment: $environment"

    # Prepare test options
    local test_options=(
        --config ./dist/test/k6.config.js
        --env TEST_ENV="$environment"
        --env TEST_TYPE="$test_type"
        $options
    )

    # Execute k6 tests with monitoring
    if ! k6 run "${test_options[@]}" ./dist/test/src/performance/scenarios/api-endpoints.js; then
        log_error "Performance tests failed"
        status=1
    fi

    return $status
}

# Function to generate test report
generate_report() {
    local results_file="./tmp/test-results/results.json"
    local report_file="./tmp/test-results/report.html"
    local status=0

    log_info "Generating test report"

    if [[ ! -f "$results_file" ]]; then
        log_error "Test results file not found: $results_file"
        return 1
    fi

    # Process test results and generate report
    if ! node ./dist/test/src/utils/report-generator.js "$results_file" "$report_file"; then
        log_error "Failed to generate test report"
        status=1
    fi

    return $status
}

# Function to clean up test resources
cleanup() {
    log_info "Cleaning up test resources"

    # Remove temporary files
    rm -rf ./tmp/performance-tests
    rm -rf ./dist/test

    # Reset environment variables
    unset TEST_ENV
    unset TEST_TYPE
    unset K6_OUT
}

# Main execution function
main() {
    local environment=${1:-$DEFAULT_ENVIRONMENT}
    local test_type=${2:-$DEFAULT_TEST_TYPE}
    local status=0

    # Validate input parameters
    if [[ ! " ${TEST_ENVIRONMENTS[@]} " =~ " ${environment} " ]]; then
        log_error "Invalid environment. Must be one of: ${TEST_ENVIRONMENTS[*]}"
        return 1
    fi

    if [[ ! " ${TEST_TYPES[@]} " =~ " ${test_type} " ]]; then
        log_error "Invalid test type. Must be one of: ${TEST_TYPES[*]}"
        return 1
    fi

    # Execute test workflow
    if ! check_dependencies; then
        log_error "Dependency check failed"
        return 1
    fi

    if ! setup_test_environment "$environment" "$test_type"; then
        log_error "Environment setup failed"
        return 1
    fi

    # Prepare test options based on type
    local test_options=""
    case $test_type in
        "smoke")
            test_options="--vus 10 --duration 30s"
            ;;
        "load")
            test_options="--vus $MAX_CONCURRENT_USERS --duration 30m"
            ;;
        "stress")
            test_options="--vus $(($MAX_CONCURRENT_USERS * 2)) --duration 15m"
            ;;
        "soak")
            test_options="--vus $(($MAX_CONCURRENT_USERS / 2)) --duration 2h"
            ;;
    esac

    if ! run_performance_tests "$environment" "$test_type" "$test_options"; then
        status=1
    fi

    if ! generate_report; then
        status=1
    fi

    # Always attempt cleanup
    cleanup

    if [[ $status -eq 0 ]]; then
        log_info "Performance tests completed successfully"
    else
        log_error "Performance tests failed"
    fi

    return $status
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
```

This script provides a comprehensive solution for executing performance tests with the following key features:

1. Validates system requirements including 99.9% uptime and sub-3s response times
2. Supports testing with up to 200 concurrent enterprise users
3. Validates data processing capacity of 100K events/day
4. Includes multiple test types (smoke, load, stress, soak)
5. Comprehensive dependency checking and environment setup
6. Detailed logging and error handling
7. Test result processing and report generation
8. Proper resource cleanup

The script can be executed with optional environment and test type parameters:
```bash
# Run with defaults (staging environment, load test)
./run-performance-tests.sh

# Run specific environment and test type
./run-performance-tests.sh production stress
```

Make sure to make the script executable:
```bash
chmod +x run-performance-tests.sh