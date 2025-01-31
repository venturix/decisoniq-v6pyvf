/**
 * Customer data model type definitions
 * @version 1.0.0
 * @package @customer-success-ai/web
 */

/**
 * Enum of sortable customer fields for consistent sorting
 */
export enum CustomerSortField {
  NAME = 'NAME',
  CONTRACT_START = 'CONTRACT_START',
  CONTRACT_END = 'CONTRACT_END',
  MRR = 'MRR',
  HEALTH_SCORE = 'HEALTH_SCORE',
  RISK_SCORE = 'RISK_SCORE',
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT'
}

/**
 * Enum of possible customer risk levels with clear categorization
 */
export enum CustomerRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Enum of customer risk factor categories for classification
 */
export enum CustomerRiskCategory {
  USAGE = 'USAGE',
  ENGAGEMENT = 'ENGAGEMENT',
  SUPPORT = 'SUPPORT',
  FINANCIAL = 'FINANCIAL',
  PRODUCT_FIT = 'PRODUCT_FIT'
}

/**
 * Enum of customer risk trend directions for tracking changes
 */
export enum CustomerRiskTrend {
  IMPROVING = 'IMPROVING',
  STABLE = 'STABLE',
  WORSENING = 'WORSENING'
}

/**
 * Interface for customer usage metrics tracking
 */
export interface CustomerUsageMetrics {
  activeUsers: number;
  featureAdoption: Record<string, number>;
  lastLoginDate: Date;
  sessionDuration: number;
  apiUsage: number;
}

/**
 * Interface for customer engagement metrics tracking
 */
export interface CustomerEngagementMetrics {
  lastInteraction: Date;
  interactionFrequency: number;
  npsScore?: number;
  trainingCompletion: number;
  feedbackSentiment: number;
}

/**
 * Interface for customer support metrics tracking
 */
export interface CustomerSupportMetrics {
  openTickets: number;
  avgResolutionTime: number;
  criticalIssues: number;
  lastTicketDate?: Date;
  satisfactionScore: number;
}

/**
 * Interface for customer financial metrics tracking
 */
export interface CustomerFinancialMetrics {
  totalRevenue: number;
  lifetimeValue: number;
  expansionOpportunities: number;
  paymentHistory: number;
  contractValue: number;
}

/**
 * Interface for individual risk factor assessment
 */
export interface CustomerRiskFactor {
  name: string;
  impact: number;
  category: CustomerRiskCategory;
  trend: CustomerRiskTrend;
  details: Record<string, unknown>;
}

/**
 * Interface for comprehensive customer risk profile
 */
export interface CustomerRiskProfile {
  score: number;
  level: CustomerRiskLevel;
  factors: CustomerRiskFactor[];
  trend: CustomerRiskTrend;
  readonly lastAssessment: Date;
}

/**
 * Interface for comprehensive customer metadata
 */
export interface CustomerMetadata {
  usageMetrics: CustomerUsageMetrics;
  engagementMetrics: CustomerEngagementMetrics;
  supportMetrics: CustomerSupportMetrics;
  financialMetrics: CustomerFinancialMetrics;
  customFields: Record<string, unknown>;
}

/**
 * Core customer interface with comprehensive data model
 */
export interface Customer {
  readonly id: string;
  name: string;
  contractStart: Date;
  contractEnd: Date;
  mrr: number;
  healthScore: number;
  riskProfile: CustomerRiskProfile;
  metadata: CustomerMetadata;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Generic base response interface for API responses
 */
export interface BaseResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Typed API response wrapper for single customer data
 */
export interface CustomerResponse extends BaseResponse<Customer> {}

/**
 * Typed API response wrapper for paginated customer list
 */
export interface CustomerListResponse extends BaseResponse<Customer[]> {
  total: number;
  page: number;
  pageSize: number;
}