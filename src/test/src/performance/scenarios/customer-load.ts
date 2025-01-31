/**
 * Performance testing scenario for customer data load and API operations
 * Validates system performance under high concurrency conditions
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports - k6 v0.45.x
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Internal imports
import { ApiClient } from '../../utils/api-client';
import { PerformanceThresholds } from '../../config/performance-thresholds';
import { CustomerTestData } from '../../types/customer';

// Custom metrics for detailed performance tracking
const customer_creation_rate = new Rate('customer_creation_success');
const health_score_latency = new Trend('health_score_calculation_time');
const error_rate = new Rate('operation_errors');
const prediction_accuracy = new Rate('prediction_accuracy');

// Performance test configuration constants
export const BATCH_SIZE = 100;
export const CONCURRENT_USERS = 200;
export const TEST_DURATION = 300;
export const PERFORMANCE_THRESHOLDS = {
    prediction_latency_ms: 3000,
    error_rate_threshold: 0.001,
    success_rate_threshold: 0.999
};

/**
 * Test context interface for managing test state and resources
 */
interface TestContext {
    client: ApiClient;
    testData: CustomerTestData[];
    metrics: {
        successRate: Rate;
        latency: Trend;
        errorRate: Rate;
    };
}

/**
 * Performance test options interface
 */
interface PerformanceOptions {
    vus: number;
    duration: number;
    batchSize: number;
    thresholds: typeof PERFORMANCE_THRESHOLDS;
}

/**
 * Initializes the customer load test environment
 * @param environment Test environment configuration
 * @param options Performance test options
 */
export async function setupCustomerLoadTest(
    environment: string,
    options: Partial<PerformanceOptions> = {}
): Promise<TestContext> {
    const client = new ApiClient(environment as any, {
        timeout: 10000,
        enableRetry: true,
        maxRetries: 3,
        enableMetrics: true
    });

    // Generate test data for different scenarios
    const testData = Array(options.batchSize || BATCH_SIZE).fill(null).map(() => ({
        name: `Test Customer ${Date.now()}`,
        contractStart: new Date(),
        contractEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        mrr: Math.floor(Math.random() * 10000) + 1000,
        metadata: {
            testScenario: 'performance',
            timestamp: Date.now()
        }
    }));

    return {
        client,
        testData,
        metrics: {
            successRate: customer_creation_rate,
            latency: health_score_latency,
            errorRate: error_rate
        }
    };
}

/**
 * Executes bulk customer operations with concurrent user simulation
 * @param client API client instance
 * @param testData Array of test customer data
 * @param options Performance test options
 */
export async function customerBulkOperations(
    client: ApiClient,
    testData: CustomerTestData[],
    options: PerformanceOptions
): Promise<void> {
    const batchSize = options.batchSize || BATCH_SIZE;
    const batches = Math.ceil(testData.length / batchSize);

    group('Customer Bulk Creation', () => {
        for (let i = 0; i < batches; i++) {
            const batch = testData.slice(i * batchSize, (i + 1) * batchSize);
            const startTime = Date.now();

            try {
                const response = client.post('/api/v1/customers/bulk', batch);
                check(response, {
                    'bulk creation successful': (r) => r.status === 200,
                    'response time within threshold': (r) => 
                        Date.now() - startTime <= PERFORMANCE_THRESHOLDS.prediction_latency_ms
                });

                customer_creation_rate.add(true);
                error_rate.add(false);
            } catch (error) {
                customer_creation_rate.add(false);
                error_rate.add(true);
            }

            // Respect rate limits
            sleep(1);
        }
    });
}

/**
 * Tests customer health score calculation under load
 * @param client API client instance
 * @param customerIds Array of customer IDs
 * @param options Performance test options
 */
export async function customerHealthScoreLoad(
    client: ApiClient,
    customerIds: string[],
    options: PerformanceOptions
): Promise<void> {
    group('Health Score Calculations', () => {
        customerIds.forEach(customerId => {
            const startTime = Date.now();

            try {
                const response = client.get(`/api/v1/customers/${customerId}/health-score`);
                const duration = Date.now() - startTime;

                check(response, {
                    'health score calculation successful': (r) => r.status === 200,
                    'prediction within latency threshold': () => 
                        duration <= PERFORMANCE_THRESHOLDS.prediction_latency_ms
                });

                health_score_latency.add(duration);
                prediction_accuracy.add(true);
            } catch (error) {
                prediction_accuracy.add(false);
                error_rate.add(true);
            }

            // Prevent overwhelming the API
            sleep(0.5);
        });
    });
}

/**
 * Default export for k6 execution
 */
export default function() {
    const options: PerformanceOptions = {
        vus: CONCURRENT_USERS,
        duration: TEST_DURATION,
        batchSize: BATCH_SIZE,
        thresholds: PERFORMANCE_THRESHOLDS
    };

    const context = setupCustomerLoadTest('staging', options);
    
    group('Customer Load Test Scenario', () => {
        customerBulkOperations(context.client, context.testData, options);
        customerHealthScoreLoad(context.client, 
            context.testData.map(c => c.id), 
            options
        );
    });

    // Validate performance metrics
    check(context.metrics, {
        'error rate within threshold': (m) => 
            m.errorRate.rate < PERFORMANCE_THRESHOLDS.error_rate_threshold,
        'success rate meets threshold': (m) => 
            m.successRate.rate >= PERFORMANCE_THRESHOLDS.success_rate_threshold,
        'average latency within limits': (m) => 
            m.latency.avg < PERFORMANCE_THRESHOLDS.prediction_latency_ms
    });
}