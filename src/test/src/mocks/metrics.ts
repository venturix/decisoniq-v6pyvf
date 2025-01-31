import { faker } from '@faker-js/faker'; // faker@8.x
import { 
  MetricType, 
  CustomerMetric 
} from '../types/metrics';

/**
 * Configuration for mock metric generation
 */
const MOCK_METRIC_CONFIG = {
  healthScoreRange: { min: 0, max: 100 },
  riskScoreRange: { min: 0, max: 100 },
  timeSeriesMaxVariance: 10,
  defaultTimeSeriesDays: 30,
  seasonalityPatterns: ['weekly', 'monthly', 'quarterly'] as const,
  anomalyFrequency: 0.05,
  correlationFactor: 0.7,
  businessHourPatterns: true
} as const;

/**
 * Options for metric generation
 */
interface MetricGenerationOptions {
  timestamp?: Date;
  seasonality?: boolean;
  industryFactor?: number;
  variance?: number;
}

/**
 * Options for time series generation
 */
interface TimeSeriesOptions {
  seasonality?: boolean;
  trend?: 'up' | 'down' | 'stable';
  volatility?: number;
  anomalies?: boolean;
  businessHours?: boolean;
}

/**
 * Creates a mock health score metric with realistic value distribution
 */
export function createMockHealthScore(
  customerId: string,
  options: MetricGenerationOptions = {}
): CustomerMetric {
  const { min, max } = MOCK_METRIC_CONFIG.healthScoreRange;
  
  // Generate base score using normal distribution
  let score = faker.number.float({
    min: min + 20, // Bias towards middle range
    max: max - 20,
    precision: 0.1
  });

  // Apply industry adjustment if specified
  if (options.industryFactor) {
    score *= options.industryFactor;
  }

  // Apply seasonal variations if enabled
  if (options.seasonality) {
    const seasonalFactor = Math.sin(new Date().getMonth() * Math.PI / 6);
    score += seasonalFactor * 5;
  }

  // Ensure score stays within valid range
  score = Math.max(min, Math.min(max, score));

  return {
    customerId,
    metricType: MetricType.HEALTH_SCORE,
    value: score,
    timestamp: options.timestamp || new Date(),
    metadata: {
      generatedBy: 'mockMetrics',
      variance: options.variance || 0
    }
  };
}

/**
 * Creates a mock risk score with inverse correlation to health score
 */
export function createMockRiskScore(
  customerId: string,
  options: MetricGenerationOptions = {}
): CustomerMetric {
  const { min, max } = MOCK_METRIC_CONFIG.riskScoreRange;
  const correlationFactor = MOCK_METRIC_CONFIG.correlationFactor;

  // Generate inversely correlated risk score
  const healthScore = createMockHealthScore(customerId, options);
  let riskScore = max - (healthScore.value * correlationFactor);

  // Add random variance
  const variance = options.variance || faker.number.float({ min: -5, max: 5 });
  riskScore += variance;

  // Ensure score stays within valid range
  riskScore = Math.max(min, Math.min(max, riskScore));

  return {
    customerId,
    metricType: MetricType.RISK_SCORE,
    value: riskScore,
    timestamp: options.timestamp || new Date(),
    metadata: {
      correlatedHealthScore: healthScore.value,
      generatedBy: 'mockMetrics',
      variance
    }
  };
}

/**
 * Generates time series mock data with realistic patterns
 */
export function createMockMetricTimeSeries(
  customerId: string,
  metricType: MetricType,
  days: number = MOCK_METRIC_CONFIG.defaultTimeSeriesDays,
  options: TimeSeriesOptions = {}
): CustomerMetric[] {
  const series: CustomerMetric[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - days);

  // Initialize trend parameters
  const trendSlope = options.trend === 'up' ? 0.5 : 
                     options.trend === 'down' ? -0.5 : 0;
  const volatility = options.volatility || 0.1;

  for (let i = 0; i < days; i++) {
    const currentDate = new Date(baseDate);
    currentDate.setDate(currentDate.getDate() + i);

    // Skip non-business hours if enabled
    if (options.businessHours && 
        (currentDate.getHours() < 9 || currentDate.getHours() > 17)) {
      continue;
    }

    // Calculate base value with trend
    let value = 50 + (trendSlope * i);

    // Add seasonality if enabled
    if (options.seasonality) {
      const weekday = currentDate.getDay();
      const seasonal = Math.sin(weekday * Math.PI / 3.5) * 5;
      value += seasonal;
    }

    // Add random walk component
    value += faker.number.float({ 
      min: -volatility * MOCK_METRIC_CONFIG.timeSeriesMaxVariance,
      max: volatility * MOCK_METRIC_CONFIG.timeSeriesMaxVariance
    });

    // Add anomalies if enabled
    if (options.anomalies && 
        faker.number.float() < MOCK_METRIC_CONFIG.anomalyFrequency) {
      value += faker.number.float({ min: -20, max: 20 });
    }

    // Create metric point
    const metric = metricType === MetricType.HEALTH_SCORE ?
      createMockHealthScore(customerId, { timestamp: currentDate }) :
      createMockRiskScore(customerId, { timestamp: currentDate });

    metric.value = Math.max(0, Math.min(100, value));
    series.push(metric);
  }

  return series;
}

/**
 * Creates invalid metric data for negative testing
 */
export function createInvalidMetric(
  customerId: string,
  type: 'outOfBounds' | 'invalidDate' | 'malformed' | 'corrupted'
): CustomerMetric {
  switch (type) {
    case 'outOfBounds':
      return {
        customerId,
        metricType: MetricType.HEALTH_SCORE,
        value: faker.number.float({ min: 101, max: 1000 }),
        timestamp: new Date(),
        metadata: { invalid: 'outOfBounds' }
      };

    case 'invalidDate':
      return {
        customerId,
        metricType: MetricType.HEALTH_SCORE,
        value: faker.number.float({ min: 0, max: 100 }),
        timestamp: new Date('invalid'),
        metadata: { invalid: 'invalidDate' }
      };

    case 'malformed':
      return {
        customerId,
        metricType: 'INVALID_TYPE' as MetricType,
        value: 'not_a_number' as unknown as number,
        timestamp: new Date(),
        metadata: { invalid: 'malformed' }
      };

    case 'corrupted':
      return {
        customerId: '',
        metricType: MetricType.HEALTH_SCORE,
        value: NaN,
        timestamp: new Date(),
        metadata: { invalid: 'corrupted' }
      };
  }
}

/**
 * Pre-generated mock data sets for common test scenarios
 */
export const mockMetrics = {
  validHealthScores: Array.from({ length: 10 }, (_, i) => 
    createMockHealthScore(`customer-${i}`)),

  validRiskScores: Array.from({ length: 10 }, (_, i) => 
    createMockRiskScore(`customer-${i}`)),

  invalidMetrics: [
    createInvalidMetric('invalid-1', 'outOfBounds'),
    createInvalidMetric('invalid-2', 'invalidDate'),
    createInvalidMetric('invalid-3', 'malformed'),
    createInvalidMetric('invalid-4', 'corrupted')
  ],

  timeSeriesData: createMockMetricTimeSeries(
    'customer-timeseries',
    MetricType.HEALTH_SCORE,
    30,
    {
      seasonality: true,
      trend: 'down',
      volatility: 0.2,
      anomalies: true,
      businessHours: true
    }
  )
};