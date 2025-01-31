#!/bin/bash

# Set strict error handling
set -euo pipefail

# Trap errors and cleanup
trap cleanup ERR INT TERM EXIT

# Script version and metadata
readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_NAME="generate-test-data.sh"
readonly SCRIPT_DESCRIPTION="Test data generator for Customer Success AI Platform"

# Environment configuration with defaults
readonly TEST_ENV="${TEST_ENV:-development}"
readonly TEST_DATA_SEED="${TEST_DATA_SEED:-cs-ai-platform}"
readonly OUTPUT_DIR="../data/fixtures"
readonly PERFORMANCE_LOG="../logs/performance.log"
readonly VALIDATION_LOG="../logs/validation.log"

# Node.js version requirements
readonly MIN_NODE_VERSION="18.0.0"
readonly MIN_TS_NODE_VERSION="10.0.0"

# Performance thresholds (ms)
readonly MAX_GENERATION_TIME=30000
readonly MAX_MEMORY_USAGE=$((1024 * 1024 * 512)) # 512MB

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_performance() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$PERFORMANCE_LOG"
}

log_validation() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$VALIDATION_LOG"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    log_info "Cleaning up temporary files..."
    rm -f /tmp/cs-ai-platform-test-*.json
    if [ $exit_code -ne 0 ]; then
        log_error "Script failed with exit code $exit_code"
    fi
    exit $exit_code
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        return 1
    fi
    
    local node_version
    node_version=$(node -v | cut -d 'v' -f 2)
    if ! verify_version "$node_version" "$MIN_NODE_VERSION"; then
        log_error "Node.js version $MIN_NODE_VERSION or higher is required"
        return 1
    }

    # Check ts-node
    if ! command -v ts-node &> /dev/null; then
        log_error "ts-node is required but not installed"
        return 1
    }
    
    local ts_node_version
    ts_node_version=$(ts-node -v | cut -d 'v' -f 2)
    if ! verify_version "$ts_node_version" "$MIN_TS_NODE_VERSION"; then
        log_error "ts-node version $MIN_TS_NODE_VERSION or higher is required"
        return 1
    }

    # Check required node modules
    local required_modules=("@faker-js/faker" "utility-types" "dotenv")
    for module in "${required_modules[@]}"; do
        if ! node -e "require('$module')" &> /dev/null; then
            log_error "Required module $module is not installed"
            return 1
        fi
    done

    return 0
}

# Version comparison utility
verify_version() {
    if [[ $1 == $2 ]]; then
        return 0
    fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
        ver1[i]=0
    done
    for ((i=0; i<${#ver1[@]}; i++)); do
        if [[ -z ${ver2[i]} ]]; then
            ver2[i]=0
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            return 1
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then
            return 0
        fi
    done
    return 0
}

# Initialize directories and logging
initialize() {
    log_info "Initializing test data generation environment..."
    
    # Create required directories
    mkdir -p "$OUTPUT_DIR"/{customers,risks,playbooks,metrics}
    mkdir -p "$(dirname "$PERFORMANCE_LOG")"
    mkdir -p "$(dirname "$VALIDATION_LOG")"
    
    # Initialize log files
    : > "$PERFORMANCE_LOG"
    : > "$VALIDATION_LOG"
    
    # Set file permissions
    chmod 755 "$OUTPUT_DIR"
    chmod 644 "$PERFORMANCE_LOG" "$VALIDATION_LOG"
    
    return 0
}

# Generate customer test data
generate_customer_data() {
    log_info "Generating customer test data..."
    local start_time=$(date +%s%N)
    
    ts-node <<EOF
    import { testData } from '../src/config/test-data';
    import { TestDataGenerator } from '../src/utils/test-data-generator';
    
    const generator = new TestDataGenerator({
        seed: '${TEST_DATA_SEED}',
        performanceTracking: true,
        piiMasking: true
    });
    
    async function generateCustomers() {
        const data = await generator.generateCustomerData('create');
        require('fs').writeFileSync(
            '${OUTPUT_DIR}/customers/customers.json',
            JSON.stringify(data, null, 2)
        );
    }
    
    generateCustomers().catch(console.error);
EOF
    
    local duration=$((($(date +%s%N) - start_time)/1000000))
    log_performance "Customer data generation completed in ${duration}ms"
    
    return 0
}

# Generate risk assessment test data
generate_risk_data() {
    log_info "Generating risk assessment test data..."
    local start_time=$(date +%s%N)
    
    ts-node <<EOF
    import { testData } from '../src/config/test-data';
    import { TestDataGenerator } from '../src/utils/test-data-generator';
    
    const generator = new TestDataGenerator({
        seed: '${TEST_DATA_SEED}',
        performanceTracking: true
    });
    
    async function generateRiskData() {
        const data = await generator.generateRiskData('create');
        require('fs').writeFileSync(
            '${OUTPUT_DIR}/risks/risk-assessments.json',
            JSON.stringify(data, null, 2)
        );
    }
    
    generateRiskData().catch(console.error);
EOF
    
    local duration=$((($(date +%s%N) - start_time)/1000000))
    log_performance "Risk data generation completed in ${duration}ms"
    
    return 0
}

# Generate playbook test data
generate_playbook_data() {
    log_info "Generating playbook test data..."
    local start_time=$(date +%s%N)
    
    ts-node <<EOF
    import { testData } from '../src/config/test-data';
    import { TestDataGenerator } from '../src/utils/test-data-generator';
    
    const generator = new TestDataGenerator({
        seed: '${TEST_DATA_SEED}',
        performanceTracking: true
    });
    
    async function generatePlaybooks() {
        const data = await generator.generatePlaybookData(5);
        require('fs').writeFileSync(
            '${OUTPUT_DIR}/playbooks/playbooks.json',
            JSON.stringify(data, null, 2)
        );
    }
    
    generatePlaybooks().catch(console.error);
EOF
    
    local duration=$((($(date +%s%N) - start_time)/1000000))
    log_performance "Playbook data generation completed in ${duration}ms"
    
    return 0
}

# Validate generated data
validate_data() {
    log_info "Validating generated test data..."
    local start_time=$(date +%s%N)
    
    ts-node <<EOF
    import { testData } from '../src/config/test-data';
    import { DataValidator } from '../src/utils/test-data-generator';
    
    const validator = new DataValidator();
    
    async function validateAllData() {
        const results = await Promise.all([
            validator.validateCustomerData('${OUTPUT_DIR}/customers/customers.json'),
            validator.validateRiskData('${OUTPUT_DIR}/risks/risk-assessments.json'),
            validator.validatePlaybookData('${OUTPUT_DIR}/playbooks/playbooks.json')
        ]);
        
        const validationReport = {
            timestamp: new Date().toISOString(),
            results: results,
            summary: {
                totalValidated: results.length,
                passed: results.filter(r => r.isValid).length,
                failed: results.filter(r => !r.isValid).length
            }
        };
        
        require('fs').writeFileSync(
            '${VALIDATION_LOG}',
            JSON.stringify(validationReport, null, 2)
        );
    }
    
    validateAllData().catch(console.error);
EOF
    
    local duration=$((($(date +%s%N) - start_time)/1000000))
    log_performance "Data validation completed in ${duration}ms"
    
    return 0
}

# Main execution function
main() {
    log_info "Starting test data generation (v${SCRIPT_VERSION})"
    
    # Check dependencies and initialize
    check_dependencies || exit 1
    initialize || exit 1
    
    # Generate test data
    generate_customer_data || exit 1
    generate_risk_data || exit 1
    generate_playbook_data || exit 1
    
    # Validate generated data
    validate_data || exit 1
    
    log_info "Test data generation completed successfully"
    return 0
}

# Execute main function
main