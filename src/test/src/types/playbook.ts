// External imports
import { DeepPartial } from 'utility-types'; // v3.10.0
import { Playbook } from '../../web/src/types/playbook';

/**
 * Interface for mocked playbook step data used in testing
 */
export interface MockPlaybookStep {
    id: string;
    type: string;
    config: Record<string, any>;
    order: number;
    enabled: boolean;
    conditions: Record<string, any>[];
}

/**
 * Interface extending production Playbook type with additional testing properties
 */
export interface MockPlaybook extends Omit<Playbook, 'steps'> {
    id: string;
    name: string;
    description: string;
    steps: MockPlaybookStep[];
    isTestData?: boolean;
}

/**
 * Interface for mocked playbook execution data
 */
export interface MockPlaybookExecution {
    id: string;
    playbookId: string;
    customerId: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    currentStep: number;
    results: Record<string, any>;
    error: string | null;
    metrics: Record<string, number>;
}

/**
 * Type for generating partial playbook test fixtures
 */
export type PlaybookFixture = DeepPartial<MockPlaybook>;

/**
 * Type for generating partial playbook execution test fixtures
 */
export type PlaybookExecutionFixture = DeepPartial<MockPlaybookExecution>;

/**
 * Interface representing a mock customer for testing
 */
export interface MockCustomer {
    id: string;
    name: string;
    healthScore: number;
    riskScore: number;
    status: string;
}

/**
 * Type definition for comprehensive playbook test data sets
 */
export interface PlaybookTestData {
    playbooks: MockPlaybook[];
    executions: MockPlaybookExecution[];
    customers: MockCustomer[];
    metrics: Record<string, number>[];
}

/**
 * Type for playbook test result assertions
 */
export type PlaybookTestResult = {
    success: boolean;
    executionId: string;
    expectedSteps: number;
    completedSteps: number;
    errors: string[];
    metrics: Record<string, number>;
};