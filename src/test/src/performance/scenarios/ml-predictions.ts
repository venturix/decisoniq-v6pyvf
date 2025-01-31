/**
 * Performance test scenarios for ML prediction endpoints
 * Tests latency, throughput and accuracy of the Customer Success AI Platform's ML capabilities
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { check } from 'k6'; // v0.45.x
import { sleep } from 'k6'; // v0.45.x
import { Rate, Trend } from 'k6/metrics'; // v0.45.x

// Internal imports
import { ApiClient } from '../../utils/api-client';
import { TestEnvironment } from '../../types/test';
import { defaultThresholds } from '../../config/performance-thresholds';

// Performance metrics tracking
const predictionLatencyTrend = new Trend('ml_prediction_latency');
const predictionSuccessRate = new Rate('ml_prediction_success_rate');
const batchProcessingTrend = new Trend('ml_batch_processing_time');

/**
 * Tests latency and accuracy of single customer risk prediction
 * Validates against 3s latency requirement and 90% accuracy threshold
 */
export async function testSinglePrediction(client: ApiClient): Promise<void> {
  // Generate test customer data with known risk factors
  const testCustomer = {
    id: `test-${Date.now()}`,
    usageMetrics: {
      activeUsers: 50,
      featureAdoption: 0.6,
      lastLoginDate: new Date().toISOString()
    },
    engagementMetrics: {
      interactionFrequency: 0.4,
      npsScore: 6
    },
    financialMetrics: {
      mrr: 10000,
      paymentHistory: 0.9
    }
  };

  // Start latency measurement
  const startTime = Date.now();

  try {
    // Make prediction request
    const response = await client.post('/api/v1/predictions/risk', {
      customerId: testCustomer.id,
      features: testCustomer
    });

    // Record latency
    const latency = Date.now() - startTime;
    predictionLatencyTrend.add(latency);

    // Validate response
    check(response, {
      'prediction returned successfully': (r) => r.success === true,
      'prediction latency under 3s': (r) => latency < defaultThresholds.ml.predictionLatency,
      'prediction score is valid': (r) => {
        const score = r.data?.riskScore;
        return score >= 0 && score <= 100;
      },
      'prediction confidence meets threshold': (r) => {
        return r.data?.confidence >= defaultThresholds.ml.accuracyThreshold;
      }
    });

    predictionSuccessRate.add(response.success);

  } catch (error) {
    predictionSuccessRate.add(0);
    console.error(`Prediction failed: ${error.message}`);
  }

  // Allow system to stabilize between requests
  sleep(1);
}

/**
 * Tests performance of batch prediction processing
 * Validates system's ability to handle 100K events/day processing capacity
 */
export async function testBatchPredictions(client: ApiClient, batchSize: number): Promise<void> {
  // Generate batch test data
  const batchCustomers = Array.from({ length: batchSize }, (_, index) => ({
    id: `batch-${Date.now()}-${index}`,
    usageMetrics: {
      activeUsers: Math.floor(Math.random() * 100),
      featureAdoption: Math.random(),
      lastLoginDate: new Date().toISOString()
    },
    engagementMetrics: {
      interactionFrequency: Math.random(),
      npsScore: Math.floor(Math.random() * 10)
    },
    financialMetrics: {
      mrr: 5000 + Math.floor(Math.random() * 10000),
      paymentHistory: Math.random()
    }
  }));

  const startTime = Date.now();

  try {
    // Submit batch prediction request
    const response = await client.post('/api/v1/predictions/risk/batch', {
      customers: batchCustomers
    });

    const processingTime = Date.now() - startTime;
    batchProcessingTrend.add(processingTime);

    // Validate batch processing
    check(response, {
      'batch processing successful': (r) => r.success === true,
      'all predictions returned': (r) => r.data?.predictions?.length === batchSize,
      'processing time within limits': (r) => processingTime < defaultThresholds.ml.batchProcessingTime,
      'prediction accuracy maintained': (r) => {
        const validPredictions = r.data?.predictions?.filter(p => p.confidence >= defaultThresholds.ml.accuracyThreshold);
        return validPredictions?.length / batchSize >= 0.9;
      }
    });

  } catch (error) {
    console.error(`Batch processing failed: ${error.message}`);
  }

  // Allow system to recover between batch tests
  sleep(2);
}

/**
 * Tests system performance under concurrent prediction load
 * Validates system's ability to handle 200 concurrent enterprise users
 */
export async function testConcurrentPredictions(client: ApiClient, concurrentUsers: number): Promise<void> {
  const userRequests = Array.from({ length: concurrentUsers }, async (_, index) => {
    const testCustomer = {
      id: `concurrent-${Date.now()}-${index}`,
      usageMetrics: {
        activeUsers: Math.floor(Math.random() * 100),
        featureAdoption: Math.random(),
        lastLoginDate: new Date().toISOString()
      },
      engagementMetrics: {
        interactionFrequency: Math.random(),
        npsScore: Math.floor(Math.random() * 10)
      },
      financialMetrics: {
        mrr: 5000 + Math.floor(Math.random() * 10000),
        paymentHistory: Math.random()
      }
    };

    const startTime = Date.now();

    try {
      const response = await client.post('/api/v1/predictions/risk', {
        customerId: testCustomer.id,
        features: testCustomer
      });

      const latency = Date.now() - startTime;
      predictionLatencyTrend.add(latency);
      predictionSuccessRate.add(response.success);

      return { success: response.success, latency };
    } catch (error) {
      predictionSuccessRate.add(0);
      return { success: false, latency: Date.now() - startTime };
    }
  });

  // Execute concurrent requests
  const results = await Promise.all(userRequests);

  // Validate concurrent performance
  check(results, {
    'concurrent requests successful': (r) => {
      const successCount = r.filter(result => result.success).length;
      return successCount / concurrentUsers >= 0.95;
    },
    'latency maintained under load': (r) => {
      const p95Latency = r.map(result => result.latency)
        .sort((a, b) => a - b)[Math.floor(concurrentUsers * 0.95)];
      return p95Latency < defaultThresholds.ml.predictionLatency;
    }
  });

  // Allow system to stabilize after concurrent load
  sleep(3);
}

// Export test scenarios
export default {
  testSinglePrediction,
  testBatchPredictions,
  testConcurrentPredictions
};