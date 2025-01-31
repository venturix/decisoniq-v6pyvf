/**
 * @fileoverview TypeScript type definitions for risk assessment and scoring functionality
 * Defines types and interfaces for the Customer Success AI Platform's risk assessment capabilities
 */

/**
 * Enumeration of possible risk severity levels
 */
export enum RiskLevel {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

/**
 * Type representing valid risk score range (0-100)
 */
export type RiskScoreRange = number;

/**
 * Union type of possible risk factor categories
 */
export type RiskFactorCategory = 'usage' | 'support' | 'payment' | 'engagement';

/**
 * Interface defining risk factor weight configuration
 */
export interface RiskFactorWeight {
    usageDecline: number;    // Weight: 0.35
    supportTickets: number;  // Weight: 0.25
    paymentDelays: number;   // Weight: 0.25
    engagementScore: number; // Weight: 0.15
}

/**
 * Interface for individual risk factors contributing to overall risk assessment
 */
export interface RiskFactor {
    category: RiskFactorCategory;
    impactScore: RiskScoreRange;
    description: string;
    metadata: Record<string, unknown>;
}

/**
 * Interface for risk score with associated factors and recommendations
 */
export interface RiskScore {
    score: RiskScoreRange;
    level: RiskLevel;
    factors: readonly RiskFactor[];
    recommendations: Record<string, unknown>;
}

/**
 * Interface for complete risk assessment data structure
 */
export interface RiskAssessment {
    id: string;
    customerId: string;
    score: RiskScoreRange;
    severityLevel: RiskLevel;
    factors: readonly RiskFactor[];
    recommendations: Record<string, unknown>;
    assessedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Risk score threshold constants for determining risk levels
 */
export const RISK_SCORE_THRESHOLDS = {
    LOW: 25,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 90
} as const;

/**
 * Risk factor weight constants for score calculation
 */
export const RISK_FACTOR_WEIGHTS: Readonly<RiskFactorWeight> = {
    usageDecline: 0.35,
    supportTickets: 0.25,
    paymentDelays: 0.25,
    engagementScore: 0.15
} as const;