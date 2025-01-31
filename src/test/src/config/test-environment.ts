/**
 * Test environment configuration for Customer Success AI Platform
 * Provides comprehensive test environment settings, performance thresholds, and resource management
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

// External imports
import { config } from 'dotenv'; // v16.x

// Internal imports
import { TestEnvironment } from '../types/test';
import { defaultThresholds } from './performance-thresholds';
import { testData } from './test-data';

/**
 * Interface defining comprehensive environment-specific configuration
 */
export interface EnvironmentConfig {
  apiUrl: string;
  authUrl: string;
  timeout: number;
  database: {
    host: string;
    port: number;
    maxConnections: number;
    idleTimeoutMillis: number;
  };
  aws: {
    region: string;
    sagemakerEndpoint: string;
    s3Bucket: string;
  };
  blitzy: {
    apiKey: string;
    workspace: string;
    environment: string;
  };
  performance: {
    apiResponseTime: number;
    predictionLatency: number;
    maxConcurrentUsers: number;
  };
}

/**
 * Environment-specific configuration settings
 */
const environmentConfigs: Record<TestEnvironment, Partial<EnvironmentConfig>> = {
  development: {
    apiUrl: 'http://localhost:8000',
    authUrl: 'http://localhost:8001',
    timeout: 30000,
    database: {
      host: 'localhost',
      port: 5432,
      maxConnections: 10,
      idleTimeoutMillis: 30000
    }
  },
  staging: {
    apiUrl: 'https://api.staging.example.com',
    authUrl: 'https://auth.staging.example.com',
    timeout: 60000,
    database: {
      host: 'staging-db.example.com',
      port: 5432,
      maxConnections: 20,
      idleTimeoutMillis: 60000
    }
  },
  ci: {
    apiUrl: 'http://localhost:8000',
    authUrl: 'http://localhost:8001',
    timeout: 10000,
    database: {
      host: 'test-db',
      port: 5432,
      maxConnections: 5,
      idleTimeoutMillis: 10000
    }
  }
};

/**
 * Retrieves and validates environment-specific configuration
 * @param environment Target test environment
 * @returns Fully validated environment configuration
 */
export function getEnvironmentConfig(environment: TestEnvironment): EnvironmentConfig {
  // Load environment variables
  config();

  // Get base configuration for environment
  const baseConfig = environmentConfigs[environment];
  if (!baseConfig) {
    throw new Error(`Invalid environment: ${environment}`);
  }

  // Get performance thresholds for environment
  const thresholds = defaultThresholds;

  // Construct complete configuration
  const envConfig: EnvironmentConfig = {
    apiUrl: baseConfig.apiUrl!,
    authUrl: baseConfig.authUrl!,
    timeout: baseConfig.timeout!,
    database: baseConfig.database!,
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      sagemakerEndpoint: process.env.SAGEMAKER_ENDPOINT || '',
      s3Bucket: process.env.S3_BUCKET || ''
    },
    blitzy: {
      apiKey: process.env.BLITZY_API_KEY || '',
      workspace: process.env.BLITZY_WORKSPACE || '',
      environment: environment
    },
    performance: {
      apiResponseTime: thresholds.http.requestDuration,
      predictionLatency: thresholds.ml.predictionLatency,
      maxConcurrentUsers: thresholds.http.concurrentUsers
    }
  };

  // Validate required configuration
  validateConfig(envConfig);

  return envConfig;
}

/**
 * Initializes test environment with required configurations and resources
 * @param environment Target test environment
 */
export async function setupTestEnvironment(environment: TestEnvironment): Promise<void> {
  const config = getEnvironmentConfig(environment);

  try {
    // Initialize database connection with retry logic
    await initializeDatabase(config.database);

    // Setup AWS clients
    await setupAwsClients(config.aws);

    // Configure Blitzy SDK
    await setupBlitzySDK(config.blitzy);

    // Initialize test data
    await setupTestData(environment);

    // Verify system connections
    await verifyConnections(config);
  } catch (error) {
    throw new Error(`Failed to setup test environment: ${(error as Error).message}`);
  }
}

/**
 * Performs cleanup of test environment resources
 * @param environment Target test environment
 */
export async function teardownTestEnvironment(environment: TestEnvironment): Promise<void> {
  try {
    // Close database connections
    await cleanupDatabase();

    // Cleanup AWS resources
    await cleanupAwsResources();

    // Reset Blitzy configuration
    await resetBlitzySDK();

    // Clear test data
    await clearTestData(environment);

    // Verify cleanup
    await verifyCleanup();
  } catch (error) {
    throw new Error(`Failed to teardown test environment: ${(error as Error).message}`);
  }
}

/**
 * Validates environment configuration
 */
function validateConfig(config: EnvironmentConfig): void {
  const requiredFields = [
    'apiUrl',
    'authUrl',
    'timeout',
    'database',
    'aws',
    'blitzy',
    'performance'
  ];

  for (const field of requiredFields) {
    if (!config[field as keyof EnvironmentConfig]) {
      throw new Error(`Missing required configuration: ${field}`);
    }
  }

  if (!config.aws.sagemakerEndpoint) {
    throw new Error('Missing required AWS SageMaker endpoint configuration');
  }

  if (!config.blitzy.apiKey) {
    throw new Error('Missing required Blitzy API key configuration');
  }
}

/**
 * Initializes database connection with retry logic
 */
async function initializeDatabase(dbConfig: EnvironmentConfig['database']): Promise<void> {
  // Implementation will be in separate database utility file
}

/**
 * Sets up AWS clients and validates connections
 */
async function setupAwsClients(awsConfig: EnvironmentConfig['aws']): Promise<void> {
  // Implementation will be in separate AWS utility file
}

/**
 * Configures Blitzy SDK with environment credentials
 */
async function setupBlitzySDK(blitzyConfig: EnvironmentConfig['blitzy']): Promise<void> {
  // Implementation will be in separate Blitzy utility file
}

/**
 * Sets up test data for specified environment
 */
async function setupTestData(environment: TestEnvironment): Promise<void> {
  // Implementation will be in separate test data utility file
}

/**
 * Verifies all system connections and resources
 */
async function verifyConnections(config: EnvironmentConfig): Promise<void> {
  // Implementation will be in separate verification utility file
}

/**
 * Cleanup functions for environment teardown
 */
async function cleanupDatabase(): Promise<void> {
  // Implementation will be in separate database utility file
}

async function cleanupAwsResources(): Promise<void> {
  // Implementation will be in separate AWS utility file
}

async function resetBlitzySDK(): Promise<void> {
  // Implementation will be in separate Blitzy utility file
}

async function clearTestData(environment: TestEnvironment): Promise<void> {
  // Implementation will be in separate test data utility file
}

async function verifyCleanup(): Promise<void> {
  // Implementation will be in separate verification utility file
}