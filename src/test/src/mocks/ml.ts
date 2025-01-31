/**
 * Enhanced mock implementations of ML models and predictions for testing
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { Test } from '@jest/types'; // jest@29.x

// Internal imports
import { TestFixture } from '../types/test';
import { CustomerRiskLevel, CustomerRiskCategory, CustomerRiskTrend } from '../../../web/src/types/customer';

// Global constants for ML model configuration
const MOCK_RISK_THRESHOLDS = {
  LOW: 0.3,
  MEDIUM: 0.6,
  HIGH: 0.8,
  CRITICAL: 0.9
};

const MOCK_RISK_FACTORS = [
  'usage_decline',
  'support_tickets',
  'engagement_drop',
  'contract_value',
  'feature_adoption',
  'login_frequency'
];

const MOCK_FEATURE_IMPORTANCE = {
  usage_decline: 0.4,
  support_tickets: 0.3,
  engagement_drop: 0.2,
  contract_value: 0.1,
  feature_adoption: 0.15,
  login_frequency: 0.25
};

const MOCK_ACCURACY_THRESHOLD = 0.9;
const MOCK_FALSE_POSITIVE_THRESHOLD = 0.05;

/**
 * Enhanced interface for mock ML prediction results with comprehensive metrics
 */
export interface MockMLPrediction {
  customerId: string;
  riskScore: number;
  riskLevel: CustomerRiskLevel;
  confidence: number;
  factors: { [key: string]: number };
  featureImportance: { [key: string]: number };
  timestamp: Date;
  accuracy: number;
  falsePositiveRate: number;
  modelDrift: number;
}

/**
 * Enhanced mock implementation of risk assessment model with comprehensive validation
 */
@jest.mock('src/backend/src/ml/models/risk.py')
export class MockRiskModel {
  private _predictions: Map<string, MockMLPrediction>;
  private _featureImportance: Map<string, number>;
  private _accuracyHistory: Map<string, number>;
  private _falsePositiveHistory: Map<string, number>;

  constructor() {
    this._predictions = new Map();
    this._featureImportance = new Map(
      Object.entries(MOCK_FEATURE_IMPORTANCE)
    );
    this._accuracyHistory = new Map();
    this._falsePositiveHistory = new Map();
  }

  /**
   * Enhanced mock risk prediction with comprehensive validation
   * @param customerData Customer data for prediction
   * @returns Validated mock prediction result
   */
  async predictRisk(customerData: any): Promise<MockMLPrediction> {
    // Validate input data completeness
    if (!customerData || !customerData.id) {
      throw new Error('Invalid customer data for prediction');
    }

    // Generate base prediction
    const riskScore = this.generateRiskScore(customerData);
    const riskLevel = this.determineRiskLevel(riskScore);
    const factors = this.calculateRiskFactors(customerData);
    const confidence = this.calculateConfidence(factors);

    // Create comprehensive prediction result
    const prediction: MockMLPrediction = {
      customerId: customerData.id,
      riskScore,
      riskLevel,
      confidence,
      factors,
      featureImportance: Object.fromEntries(this._featureImportance),
      timestamp: new Date(),
      accuracy: this.calculateAccuracy(customerData.id),
      falsePositiveRate: this.calculateFalsePositiveRate(customerData.id),
      modelDrift: this.calculateModelDrift()
    };

    // Validate prediction meets requirements
    if (!this.validatePrediction(prediction)) {
      throw new Error('Prediction failed validation requirements');
    }

    // Store prediction for history tracking
    this._predictions.set(customerData.id, prediction);
    return prediction;
  }

  /**
   * Comprehensive risk factor analysis with importance weights
   * @param customerId Customer ID for analysis
   * @returns Detailed factor analysis with weights
   */
  analyzeRiskFactors(customerId: string): { 
    factors: { [key: string]: number },
    importance: { [key: string]: number },
    trends: { [key: string]: CustomerRiskTrend }
  } {
    const prediction = this._predictions.get(customerId);
    if (!prediction) {
      throw new Error('No prediction history found for customer');
    }

    const trends: { [key: string]: CustomerRiskTrend } = {};
    for (const factor of MOCK_RISK_FACTORS) {
      trends[factor] = this.calculateFactorTrend(customerId, factor);
    }

    return {
      factors: prediction.factors,
      importance: prediction.featureImportance,
      trends
    };
  }

  /**
   * Validates prediction accuracy and metrics
   * @param prediction Prediction to validate
   * @returns Validation result
   */
  private validatePrediction(prediction: MockMLPrediction): boolean {
    // Validate accuracy threshold
    if (prediction.accuracy < MOCK_ACCURACY_THRESHOLD) {
      return false;
    }

    // Validate false positive rate
    if (prediction.falsePositiveRate > MOCK_FALSE_POSITIVE_THRESHOLD) {
      return false;
    }

    // Validate feature importance scores
    const totalImportance = Object.values(prediction.featureImportance)
      .reduce((sum, value) => sum + value, 0);
    if (Math.abs(totalImportance - 1) > 0.001) {
      return false;
    }

    // Validate confidence score
    if (prediction.confidence < 0 || prediction.confidence > 1) {
      return false;
    }

    return true;
  }

  private generateRiskScore(customerData: any): number {
    // Implement mock risk score generation based on customer data
    return Math.random();
  }

  private determineRiskLevel(score: number): CustomerRiskLevel {
    if (score >= MOCK_RISK_THRESHOLDS.CRITICAL) return CustomerRiskLevel.CRITICAL;
    if (score >= MOCK_RISK_THRESHOLDS.HIGH) return CustomerRiskLevel.HIGH;
    if (score >= MOCK_RISK_THRESHOLDS.MEDIUM) return CustomerRiskLevel.MEDIUM;
    return CustomerRiskLevel.LOW;
  }

  private calculateRiskFactors(customerData: any): { [key: string]: number } {
    const factors: { [key: string]: number } = {};
    for (const factor of MOCK_RISK_FACTORS) {
      factors[factor] = Math.random();
    }
    return factors;
  }

  private calculateConfidence(factors: { [key: string]: number }): number {
    return Object.values(factors).reduce((sum, value) => sum + value, 0) / 
      Object.keys(factors).length;
  }

  private calculateAccuracy(customerId: string): number {
    const accuracy = 0.92 + (Math.random() * 0.08);
    this._accuracyHistory.set(customerId, accuracy);
    return accuracy;
  }

  private calculateFalsePositiveRate(customerId: string): number {
    const rate = Math.random() * 0.05;
    this._falsePositiveHistory.set(customerId, rate);
    return rate;
  }

  private calculateModelDrift(): number {
    return Math.random() * 0.1;
  }

  private calculateFactorTrend(
    customerId: string,
    factor: string
  ): CustomerRiskTrend {
    const random = Math.random();
    if (random < 0.33) return CustomerRiskTrend.IMPROVING;
    if (random < 0.66) return CustomerRiskTrend.STABLE;
    return CustomerRiskTrend.WORSENING;
  }
}