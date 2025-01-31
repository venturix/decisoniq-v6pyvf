// External imports
// uuid v9.0.0+ - Type definition for unique identifiers
import { UUID } from 'uuid';

/**
 * Enum representing the possible states of a playbook in its lifecycle
 */
export enum PlaybookStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    ARCHIVED = 'ARCHIVED'
}

/**
 * Enum representing the different mechanisms that can trigger a playbook
 */
export enum PlaybookTriggerType {
    RISK_SCORE = 'RISK_SCORE',
    HEALTH_SCORE = 'HEALTH_SCORE',
    MANUAL = 'MANUAL',
    SCHEDULED = 'SCHEDULED'
}

/**
 * Union type defining all possible execution status values for playbook instances
 */
export type PlaybookExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Interface defining the structure and configuration of individual steps within a playbook
 */
export interface PlaybookStep {
    readonly stepId: string;
    readonly actionType: string;
    readonly actionConfig: Record<string, any>;
    readonly nextStep: string | null;
    readonly conditions: Record<string, any> | null;
}

/**
 * Core interface defining the complete structure of a playbook with strict typing
 */
export interface Playbook {
    readonly id: UUID;
    readonly name: string;
    readonly description: string;
    readonly steps: readonly PlaybookStep[];
    readonly triggerType: PlaybookTriggerType;
    readonly triggerConditions: Record<string, any>;
    readonly status: PlaybookStatus;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

/**
 * Interface for tracking individual playbook execution instances
 */
export interface PlaybookExecution {
    readonly id: UUID;
    readonly playbookId: UUID;
    readonly customerId: UUID;
    readonly status: PlaybookExecutionStatus;
    readonly results: Record<string, any>;
    readonly startedAt: Date;
    readonly completedAt: Date | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

/**
 * Interface defining the required properties for creating a new playbook
 */
export interface PlaybookCreateRequest {
    readonly name: string;
    readonly description: string;
    readonly steps: PlaybookStep[];
    readonly triggerType: PlaybookTriggerType;
    readonly triggerConditions: Record<string, any>;
}

/**
 * Interface defining the required properties for updating an existing playbook
 */
export interface PlaybookUpdateRequest {
    readonly id: UUID;
    readonly name: string;
    readonly description: string;
    readonly steps: PlaybookStep[];
    readonly triggerType: PlaybookTriggerType;
    readonly triggerConditions: Record<string, any>;
    readonly status: PlaybookStatus;
}