/**
 * Test suite for metrics API endpoints with comprehensive validation of performance requirements
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { describe, it, expect, beforeEach, afterEach } from 'jest'; // jest@29.x

// Internal imports
import { ApiClient } from '../utils/api-client';
import { mockMetrics, createMockMetricTimeSeries } from '../mocks/metrics';
import { MetricType, CustomerMetric } from '../types/metrics';

// Constants
const TEST_TIMEOUT = 5000; // 5 second timeout for tests
const PERFORMANCE_THRESHOLD = 3000; // 3 second performance requirement

/**
 * Comprehensive test suite for metrics API validation
 */
describe('Metrics API Integration Tests', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient('test');
  });

  afterEach(async () => {
    // Cleanup and record performance metrics
    const metrics = apiClient.getMetrics();
    expect(metrics).toBeDefined();
  });

  describe('Customer Health Score Tests', () => {
    it('should calculate health scores within performance requirements', async () => {
      const { validHealthScores } = mockMetrics;
      
      const startTime = Date.now();
      const response = await apiClient.post('/api/v1/metrics/health-scores', {
        customers: validHealthScores.map(score => score.customerId)
      });
      const duration = Date.now() - startTime;

      // Validate performance
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(validHealthScores.length);

      // Validate score calculations
      response.data.forEach((score: CustomerMetric) => {
        expect(score.value).toBeGreaterThanOrEqual(0);
        expect(score.value).toBeLessThanOrEqual(100);
        expect(score.metricType).toBe(MetricType.HEALTH_SCORE);
      });
    }, TEST_TIMEOUT);

    it('should handle invalid health score requests gracefully', async () => {
      const { invalidMetrics } = mockMetrics;
      
      const response = await apiClient.post('/api/v1/metrics/health-scores', {
        customers: invalidMetrics.map(metric => metric.customerId)
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Aggregated Metrics Tests', () => {
    it('should aggregate metrics with time series analysis', async () => {
      const timeSeriesData = createMockMetricTimeSeries(
        'test-customer',
        MetricType.HEALTH_SCORE,
        30,
        { seasonality: true, trend: 'down' }
      );

      const startTime = Date.now();
      const response = await apiClient.post('/api/v1/metrics/aggregate', {
        customerId: 'test-customer',
        metricType: MetricType.HEALTH_SCORE,
        timeWindow: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          intervalType: 'daily'
        }
      });
      const duration = Date.now() - startTime;

      // Validate performance
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(response.success).toBe(true);

      // Validate aggregation results
      expect(response.data).toHaveProperty('daily');
      expect(response.data).toHaveProperty('trend');
      expect(response.data).toHaveProperty('statistics');
    }, TEST_TIMEOUT);
  });

  describe('Revenue Impact Tests', () => {
    it('should calculate revenue impact with high accuracy', async () => {
      const { validRiskScores } = mockMetrics;
      
      const startTime = Date.now();
      const response = await apiClient.post('/api/v1/metrics/revenue-impact', {
        customers: validRiskScores.map(score => ({
          customerId: score.customerId,
          riskScore: score.value
        }))
      });
      const duration = Date.now() - startTime;

      // Validate performance
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(response.success).toBe(true);

      // Validate impact calculations
      response.data.forEach((impact: any) => {
        expect(impact).toHaveProperty('predictedChurn');
        expect(impact).toHaveProperty('revenueAtRisk');
        expect(impact).toHaveProperty('confidence');
        expect(impact.confidence).toBeGreaterThanOrEqual(0.8);
      });
    }, TEST_TIMEOUT);
  });

  describe('Performance Report Tests', () => {
    it('should generate comprehensive performance reports', async () => {
      const startTime = Date.now();
      const response = await apiClient.get('/api/v1/metrics/performance', {
        timeframe: 'last_30_days',
        metrics: ['churn_rate', 'expansion_revenue', 'operational_efficiency']
      });
      const duration = Date.now() - startTime;

      // Validate performance
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(response.success).toBe(true);

      // Validate report structure
      expect(response.data).toHaveProperty('churnReduction');
      expect(response.data).toHaveProperty('revenueImpact');
      expect(response.data).toHaveProperty('efficiency');

      // Validate specific metrics
      expect(response.data.churnReduction).toHaveProperty('percentage');
      expect(response.data.revenueImpact).toHaveProperty('expansionRevenue');
      expect(response.data.efficiency).toHaveProperty('manualInterventionReduction');
    }, TEST_TIMEOUT);

    it('should validate performance metrics against requirements', async () => {
      const response = await apiClient.get('/api/v1/metrics/performance/validation');

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('uptime');
      expect(response.data.uptime).toBeGreaterThanOrEqual(99.9);
      expect(response.data).toHaveProperty('responseTime');
      expect(response.data.responseTime.p95).toBeLessThan(3000);
    });
  });
});