/**
 * Performance test scenario for playbook execution in Customer Success AI Platform
 * Validates execution performance, throughput, and scalability under load
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { check, sleep } from 'k6'; // v0.45.x
import { Rate, Trend } from 'k6/metrics'; // v0.45.x

// Internal imports
import { ApiClient } from '../../utils/api-client';
import { PerformanceThresholds, defaultThresholds } from '../../config/performance-thresholds';
import { MockPlaybook, PlaybookTestData } from '../../types/playbook';

// Performance metrics tracking
const playbookExecutionTrend = new Trend('playbook_execution_duration');
const playbookSuccessRate = new Rate('playbook_success_rate');

// Test configuration constants
const TEST_CONFIG = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Increase to 100 users
    { duration: '5m', target: 200 },  // Peak load of 200 users
    { duration: '2m', target: 50 },   // Scale down
    { duration: '1m', target: 0 }     // Cool down
  ],
  thresholds: {
    'playbook_execution_duration': ['p95<4000'], // 95% of executions under 4s
    'playbook_success_rate': ['rate>0.999'],     // 99.9% success rate
    'http_req_duration': ['p95<3000']            // API response time under 3s
  }
};

/**
 * Main performance test scenario for playbook execution
 */
export default function(data: PlaybookTestData) {
  const apiClient = new ApiClient('staging');
  const playbook = data.playbooks[0];
  const customerId = data.customers[0].id;

  // Execute playbook with performance tracking
  const executionResult = executePlaybook(playbook, customerId);
  
  // Validate performance metrics
  check(executionResult, {
    'playbook execution successful': (r) => r === true,
  });

  // Simulate user think time
  sleep(1);
}

/**
 * Executes a single playbook instance with performance tracking
 * @param playbook Playbook configuration to execute
 * @param customerId Target customer ID
 * @returns Execution success status
 */
async function executePlaybook(playbook: MockPlaybook, customerId: string): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    const response = await apiClient.post('/api/v1/playbooks/execute', {
      playbookId: playbook.id,
      customerId: customerId,
      metadata: {
        testRun: true,
        timestamp: new Date().toISOString()
      }
    });

    const duration = Date.now() - startTime;
    playbookExecutionTrend.add(duration);
    
    const success = response.success && response.statusCode === 200;
    playbookSuccessRate.add(success ? 1 : 0);

    // Validate performance against thresholds
    return validatePerformance(duration);
  } catch (error) {
    playbookSuccessRate.add(0);
    console.error(`Playbook execution failed: ${error.message}`);
    return false;
  }
}

/**
 * Validates execution performance against defined thresholds
 * @param duration Execution duration in milliseconds
 * @returns Validation result
 */
function validatePerformance(duration: number): boolean {
  const thresholds = defaultThresholds.api.playbooks;
  
  // Check against p95 response time threshold
  if (duration > thresholds.p95ResponseTime) {
    console.warn(`Performance threshold exceeded: ${duration}ms > ${thresholds.p95ResponseTime}ms`);
    return false;
  }

  // Check against maximum response time threshold
  if (duration > thresholds.maxResponseTime) {
    console.error(`Maximum response time exceeded: ${duration}ms > ${thresholds.maxResponseTime}ms`);
    return false;
  }

  return true;
}

// Export test functions for external use
export { executePlaybook, validatePerformance };