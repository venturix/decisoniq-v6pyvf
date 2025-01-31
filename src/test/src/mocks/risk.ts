/**
 * @fileoverview Mock data and factory functions for risk assessment testing
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { faker } from '@faker-js/faker'; // v8.0.0
import { DeepPartial } from 'utility-types'; // v3.10.0
import { 
  RiskScore, 
  RiskLevel, 
  RiskFactor,
  RiskFactorCategory,
  RISK_SCORE_THRESHOLDS,
  RISK_FACTOR_WEIGHTS
} from '../../../web/src/types/risk';
import { RiskTestData, RiskScoreRange, RiskTestScenario } from '../types/risk';

// Constants for risk score validation and generation
const RISK_SCORE_RANGES = {
  LOW: { min: 0, max: 25 },
  MEDIUM: { min: 26, max: 50 },
  HIGH: { min: 51, max: 75 },
  CRITICAL: { min: 76, max: 100 }
} as const;

const MOCK_RISK_CATEGORIES = [
  'USAGE',
  'ENGAGEMENT',
  'SUPPORT',
  'FINANCIAL',
  'PRODUCT_FIT'
] as const;

const RISK_VALIDATION_RULES = {
  scoreRange: { min: 0, max: 100 },
  factorCount: { min: 1, max: 10 },
  impactRange: { min: 1, max: 5 }
} as const;

interface RiskScoreOptions {
  level?: RiskLevel;
  factorCount?: number;
  categories?: RiskFactorCategory[];
  seed?: number;
}

interface RiskFactorOptions {
  category?: RiskFactorCategory;
  impactScore?: number;
  withTrend?: boolean;
}

/**
 * Creates a mock risk score with realistic data
 * @param customerId Customer ID to associate with risk score
 * @param options Configuration options for mock generation
 * @returns Generated mock risk score
 */
export function createMockRiskScore(
  customerId: string,
  options: RiskScoreOptions = {}
): RiskScore {
  if (options.seed) {
    faker.seed(options.seed);
  }

  const level = options.level || faker.helpers.arrayElement(Object.values(RiskLevel));
  const range = RISK_SCORE_RANGES[level];
  const score = faker.number.int({ min: range.min, max: range.max });
  
  const factorCount = options.factorCount || 
    faker.number.int({ 
      min: RISK_VALIDATION_RULES.factorCount.min,
      max: RISK_VALIDATION_RULES.factorCount.max 
    });

  const factors = createMockRiskFactors(factorCount, options.categories);

  return {
    score,
    level,
    factors,
    recommendations: generateMockRecommendations(level, factors)
  };
}

/**
 * Generates mock risk factors with realistic impact scores
 * @param count Number of factors to generate
 * @param categories Optional specific categories to use
 * @returns Array of mock risk factors
 */
function createMockRiskFactors(
  count: number,
  categories?: RiskFactorCategory[]
): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const availableCategories = categories || Object.values(RiskFactorCategory);

  for (let i = 0; i < count; i++) {
    const category = faker.helpers.arrayElement(availableCategories);
    const impactScore = faker.number.int({
      min: RISK_VALIDATION_RULES.impactRange.min,
      max: RISK_VALIDATION_RULES.impactRange.max
    });

    factors.push({
      category,
      impactScore,
      description: generateFactorDescription(category, impactScore),
      metadata: generateFactorMetadata(category)
    });
  }

  return factors;
}

/**
 * Generates realistic recommendations based on risk level and factors
 * @param level Risk level to generate recommendations for
 * @param factors Risk factors to consider
 * @returns Record of recommendations
 */
function generateMockRecommendations(
  level: RiskLevel,
  factors: RiskFactor[]
): Record<string, unknown> {
  const recommendations: Record<string, unknown> = {
    priority: level === RiskLevel.CRITICAL ? 'immediate' : 'standard',
    actions: [] as string[],
    timeline: level === RiskLevel.CRITICAL ? '24h' : '7d',
    automationRules: {}
  };

  factors.forEach(factor => {
    recommendations.actions.push(
      generateRecommendedAction(factor.category, factor.impactScore)
    );
  });

  return recommendations;
}

/**
 * Generates a description for a risk factor
 * @param category Risk factor category
 * @param impact Impact score of the factor
 * @returns Generated description
 */
function generateFactorDescription(
  category: RiskFactorCategory,
  impact: number
): string {
  const severity = impact >= 4 ? 'significant' : impact >= 3 ? 'moderate' : 'minor';
  
  const descriptions = {
    usage: `${severity} decline in product usage metrics`,
    support: `${severity} increase in support ticket volume`,
    payment: `${severity} issues with payment history`,
    engagement: `${severity} decrease in customer engagement`
  };

  return descriptions[category] || `${severity} risk factor identified`;
}

/**
 * Generates metadata for a risk factor
 * @param category Risk factor category
 * @returns Generated metadata
 */
function generateFactorMetadata(
  category: RiskFactorCategory
): Record<string, unknown> {
  return {
    detectedAt: faker.date.recent(),
    confidence: faker.number.float({ min: 0.7, max: 0.99, precision: 0.01 }),
    trend: faker.helpers.arrayElement(['improving', 'stable', 'worsening']),
    dataPoints: faker.number.int({ min: 10, max: 100 }),
    category
  };
}

/**
 * Generates a recommended action based on category and impact
 * @param category Risk factor category
 * @param impact Impact score
 * @returns Generated action recommendation
 */
function generateRecommendedAction(
  category: RiskFactorCategory,
  impact: number
): string {
  const actions = {
    usage: [
      'Schedule product training session',
      'Review feature adoption strategy',
      'Implement usage improvement plan'
    ],
    support: [
      'Escalate to senior support team',
      'Conduct support audit',
      'Review ticket patterns'
    ],
    payment: [
      'Schedule financial review',
      'Evaluate contract terms',
      'Review payment history'
    ],
    engagement: [
      'Schedule executive review',
      'Increase engagement touchpoints',
      'Develop retention strategy'
    ]
  };

  return faker.helpers.arrayElement(actions[category] || [
    'Schedule customer review',
    'Develop mitigation plan',
    'Monitor closely'
  ]);
}

// Pre-defined mock risk scores for common test scenarios
export const mockRiskScores = {
  low: createMockRiskScore('mock-customer-low', { level: RiskLevel.LOW }),
  medium: createMockRiskScore('mock-customer-medium', { level: RiskLevel.MEDIUM }),
  high: createMockRiskScore('mock-customer-high', { level: RiskLevel.HIGH }),
  critical: createMockRiskScore('mock-customer-critical', { level: RiskLevel.CRITICAL })
};

// Pre-defined mock risk factors by category
export const mockRiskFactors = {
  usage: createMockRiskFactors(3, ['usage']),
  engagement: createMockRiskFactors(3, ['engagement']),
  support: createMockRiskFactors(3, ['support']),
  financial: createMockRiskFactors(3, ['payment']),
  productFit: createMockRiskFactors(3, ['usage'])
};

/**
 * Creates a comprehensive mock risk assessment
 * @param customerId Customer ID to associate with assessment
 * @param options Assessment generation options
 * @returns Generated mock risk assessment
 */
export function createMockRiskAssessment(
  customerId: string,
  options: RiskScoreOptions = {}
): RiskTestData {
  const riskScore = createMockRiskScore(customerId, options);
  
  return {
    valid: [{
      customerId,
      score: riskScore.score,
      factors: riskScore.factors,
      predictedChurnDate: faker.date.future(),
      revenueImpact: faker.number.float({ min: 10000, max: 1000000 }),
      confidence: faker.number.float({ min: 0.7, max: 0.99 })
    }],
    mock: [{
      id: faker.string.uuid(),
      data: riskScore as DeepPartial<RiskScore>,
      recommendations: [{
        id: faker.string.uuid(),
        priority: faker.helpers.arrayElement(['high', 'medium', 'low']),
        action: generateRecommendedAction(riskScore.factors[0].category, riskScore.factors[0].impactScore),
        impact: faker.number.int({ min: 1, max: 5 }),
        timeframe: faker.helpers.arrayElement(['24h', '7d', '30d']),
        resources: Array.from({ length: 3 }, () => faker.word.sample())
      }],
      testScenario: 'score' as RiskTestScenario,
      expectedResults: [{
        success: true,
        data: riskScore,
        metadata: {
          version: '1.0.0',
          coverage: 100,
          generatedAt: new Date(),
          scenarios: ['score'],
          validationRules: Object.keys(RISK_VALIDATION_RULES)
        }
      }]
    }],
    metadata: {
      version: '1.0.0',
      coverage: 100,
      generatedAt: new Date(),
      scenarios: ['score'],
      validationRules: Object.keys(RISK_VALIDATION_RULES)
    }
  };
}