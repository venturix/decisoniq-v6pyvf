#!/bin/bash

# Security Test Suite Execution Script for Customer Success AI Platform
# Version: 1.0.0
# Executes comprehensive security testing including GDPR, SOC2, penetration testing, and vulnerability scanning

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_ENV="${TEST_ENV:-test}"
REPORT_DIR="${REPORT_DIR:-./reports/security}"
LOG_DIR="${REPORT_DIR}/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MAX_RETRY_ATTEMPTS=3
SECURITY_LOG_LEVEL="debug"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create required directories
setup_directories() {
    mkdir -p "${REPORT_DIR}/gdpr"
    mkdir -p "${REPORT_DIR}/soc2"
    mkdir -p "${REPORT_DIR}/penetration"
    mkdir -p "${REPORT_DIR}/vulnerability"
    mkdir -p "${LOG_DIR}"
}

# Initialize test environment
setup_test_environment() {
    log_info "Setting up security test environment..."
    
    # Verify required tools
    command -v jest >/dev/null 2>&1 || { log_error "jest is required but not installed."; exit 1; }
    command -v snyk >/dev/null 2>&1 || { log_error "snyk is required but not installed."; exit 1; }
    command -v zap-cli >/dev/null 2>&1 || { log_warn "OWASP ZAP CLI not found, skipping ZAP scans."; }

    # Set environment variables
    export NODE_ENV=test
    export SECURITY_LOG_LEVEL="${SECURITY_LOG_LEVEL}"
    export TEST_REPORT_DIR="${REPORT_DIR}"
    
    log_info "Test environment setup complete."
}

# Execute GDPR compliance tests
run_gdpr_tests() {
    log_info "Running GDPR compliance tests..."
    
    jest \
        --config="${SCRIPT_DIR}/../jest.config.js" \
        --testMatch="**/gdpr.spec.ts" \
        --runInBand \
        --forceExit \
        --json \
        --outputFile="${REPORT_DIR}/gdpr/results_${TIMESTAMP}.json" \
        --coverage \
        --coverageDirectory="${REPORT_DIR}/gdpr/coverage" \
        || return 1

    log_info "GDPR compliance tests completed."
}

# Execute SOC2 compliance tests
run_soc2_tests() {
    log_info "Running SOC2 compliance tests..."
    
    jest \
        --config="${SCRIPT_DIR}/../jest.config.js" \
        --testMatch="**/soc2.spec.ts" \
        --runInBand \
        --forceExit \
        --json \
        --outputFile="${REPORT_DIR}/soc2/results_${TIMESTAMP}.json" \
        --coverage \
        --coverageDirectory="${REPORT_DIR}/soc2/coverage" \
        || return 1

    log_info "SOC2 compliance tests completed."
}

# Execute penetration tests
run_penetration_tests() {
    log_info "Running penetration tests..."
    
    jest \
        --config="${SCRIPT_DIR}/../jest.config.js" \
        --testMatch="**/penetration/**/*.spec.ts" \
        --runInBand \
        --forceExit \
        --json \
        --outputFile="${REPORT_DIR}/penetration/results_${TIMESTAMP}.json" \
        --coverage \
        --coverageDirectory="${REPORT_DIR}/penetration/coverage" \
        || return 1

    log_info "Penetration tests completed."
}

# Execute vulnerability scanning
run_vulnerability_scan() {
    log_info "Running vulnerability scanning..."
    
    # Run Snyk security scan
    snyk test \
        --json \
        --all-projects \
        --detection-depth=4 \
        > "${REPORT_DIR}/vulnerability/snyk_${TIMESTAMP}.json" \
        || log_warn "Snyk scan completed with security issues."

    # Run OWASP ZAP scan if available
    if command -v zap-cli >/dev/null 2>&1; then
        zap-cli quick-scan \
            --self-contained \
            --start-options "-config api.disablekey=true" \
            --spider \
            --ajax-spider \
            --recursive \
            --report "${REPORT_DIR}/vulnerability/zap_${TIMESTAMP}.html" \
            http://localhost:8000 \
            || log_warn "ZAP scan completed with security issues."
    fi

    log_info "Vulnerability scanning completed."
}

# Generate comprehensive security report
generate_reports() {
    log_info "Generating security reports..."
    
    # Combine test results
    node "${SCRIPT_DIR}/../src/reports/security-reporter.js" \
        --gdpr="${REPORT_DIR}/gdpr/results_${TIMESTAMP}.json" \
        --soc2="${REPORT_DIR}/soc2/results_${TIMESTAMP}.json" \
        --penetration="${REPORT_DIR}/penetration/results_${TIMESTAMP}.json" \
        --vulnerability="${REPORT_DIR}/vulnerability/snyk_${TIMESTAMP}.json" \
        --output="${REPORT_DIR}/security_report_${TIMESTAMP}.html"

    log_info "Security reports generated at ${REPORT_DIR}/security_report_${TIMESTAMP}.html"
}

# Cleanup test environment
cleanup_environment() {
    log_info "Cleaning up test environment..."
    
    # Archive logs
    if [ -d "${LOG_DIR}" ]; then
        tar -czf "${REPORT_DIR}/logs_${TIMESTAMP}.tar.gz" -C "${LOG_DIR}" .
        rm -rf "${LOG_DIR}"
    fi
    
    # Remove temporary files
    find "${REPORT_DIR}" -name "*.tmp" -type f -delete
    
    log_info "Cleanup completed."
}

# Main execution flow with retry logic
main() {
    local retry_count=0
    local exit_code=0

    setup_directories
    setup_test_environment

    # Execute test suites with retry logic
    while [ $retry_count -lt $MAX_RETRY_ATTEMPTS ]; do
        if run_gdpr_tests && \
           run_soc2_tests && \
           run_penetration_tests && \
           run_vulnerability_scan; then
            exit_code=0
            break
        else
            exit_code=$?
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $MAX_RETRY_ATTEMPTS ]; then
                log_warn "Test execution failed. Retrying... (Attempt $((retry_count + 1))/${MAX_RETRY_ATTEMPTS})"
                sleep 5
            fi
        fi
    done

    generate_reports
    cleanup_environment

    if [ $exit_code -ne 0 ]; then
        log_error "Security tests failed after ${MAX_RETRY_ATTEMPTS} attempts."
        exit $exit_code
    fi

    log_info "Security test suite execution completed successfully."
}

# Script execution
main "$@"