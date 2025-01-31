/**
 * Centralized utility for managing and coordinating mock services across the Customer Success AI Platform test suite.
 * @version 1.0.0
 * @package @customer-success-ai/test
 */

import { jest } from '@jest/types';
import { 
  mockAuthenticateUser, 
  mockAuthenticateSSO, 
  MockAuthResponse 
} from '../mocks/auth';
import { 
  createMockCustomer, 
  createMockCustomers 
} from '../mocks/customers';
import { 
  mockRiskPrediction, 
  mockChurnPrediction, 
  MockPredictionResult 
} from '../mocks/ml';

/**
 * Interface for mock service performance monitoring
 */
interface MockPerformanceMonitor {
  startTime: number;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  logMetric: (name: string, value: number) => void;
  reset: () => void;
}

/**
 * Interface for mock resource cleanup management
 */
interface MockResourceManager {
  addResource: (key: string, cleanup: () => Promise<void>) => void;
  cleanupAll: () => Promise<void>;
  reset: () => void;
}

/**
 * Interface for mock authentication service
 */
interface MockAuthService {
  authenticateUser: typeof mockAuthenticateUser;
  authenticateSSO: typeof mockAuthenticateSSO;
  validateToken: (token: string) => boolean;
  revokeToken: (token: string) => Promise<void>;
}

/**
 * Interface for mock customer service
 */
interface MockCustomerService {
  createCustomer: typeof createMockCustomer;
  createCustomers: typeof createMockCustomers;
  getCustomer: (id: string) => Promise<any>;
  updateCustomer: (id: string, data: any) => Promise<any>;
}

/**
 * Interface for mock ML service
 */
interface MockMLService {
  predictRisk: typeof mockRiskPrediction;
  predictChurn: typeof mockChurnPrediction;
  getModelMetrics: () => Promise<Record<string, number>>;
  retrainModel: () => Promise<void>;
}

/**
 * Interface for comprehensive mock services with monitoring
 */
export interface MockServices {
  auth: MockAuthService;
  customers: MockCustomerService;
  ml: MockMLService;
  performance: MockPerformanceMonitor;
  cleanup: MockResourceManager;
}

/**
 * Interface for mock service environment configuration
 */
interface MockEnvironment {
  name: 'development' | 'staging' | 'ci';
  errorRate: number;
  latency: number;
}

/**
 * Interface for mock monitoring configuration
 */
interface MockMonitoringConfig {
  enabled: boolean;
  sampleRate: number;
  metricsRetention: number;
}

/**
 * Interface for enhanced mock service configuration
 */
export interface MockServiceConfig {
  seed: string;
  delay: number;
  errorRate: number;
  environment: MockEnvironment;
  monitoring: MockMonitoringConfig;
}

/**
 * Creates a performance monitor instance for mock services
 */
function createPerformanceMonitor(): MockPerformanceMonitor {
  let metrics: Record<string, number[]> = {};
  
  return {
    startTime: Date.now(),
    requestCount: 0,
    errorCount: 0,
    avgResponseTime: 0,
    logMetric(name: string, value: number) {
      if (!metrics[name]) metrics[name] = [];
      metrics[name].push(value);
    },
    reset() {
      this.startTime = Date.now();
      this.requestCount = 0;
      this.errorCount = 0;
      this.avgResponseTime = 0;
      metrics = {};
    }
  };
}

/**
 * Creates a resource manager instance for mock services
 */
function createResourceManager(): MockResourceManager {
  const cleanupTasks = new Map<string, () => Promise<void>>();
  
  return {
    addResource(key: string, cleanup: () => Promise<void>) {
      cleanupTasks.set(key, cleanup);
    },
    async cleanupAll() {
      for (const cleanup of cleanupTasks.values()) {
        await cleanup();
      }
      cleanupTasks.clear();
    },
    reset() {
      cleanupTasks.clear();
    }
  };
}

/**
 * Creates an instance of mock services with enhanced configuration and monitoring
 */
export function createMockServices(config?: Partial<MockServiceConfig>): MockServices {
  const performance = createPerformanceMonitor();
  const cleanup = createResourceManager();

  const defaultConfig: MockServiceConfig = {
    seed: Date.now().toString(),
    delay: 100,
    errorRate: 0.05,
    environment: {
      name: 'development',
      errorRate: 0.05,
      latency: 100
    },
    monitoring: {
      enabled: true,
      sampleRate: 0.1,
      metricsRetention: 3600
    },
    ...config
  };

  const auth: MockAuthService = {
    authenticateUser: mockAuthenticateUser,
    authenticateSSO: mockAuthenticateSSO,
    validateToken: (token: string) => token.startsWith('valid_'),
    revokeToken: async (token: string) => {
      performance.requestCount++;
      await new Promise(resolve => setTimeout(resolve, defaultConfig.delay));
    }
  };

  const customers: MockCustomerService = {
    createCustomer: createMockCustomer,
    createCustomers: createMockCustomers,
    getCustomer: async (id: string) => {
      performance.requestCount++;
      await new Promise(resolve => setTimeout(resolve, defaultConfig.delay));
      return createMockCustomer({ id });
    },
    updateCustomer: async (id: string, data: any) => {
      performance.requestCount++;
      await new Promise(resolve => setTimeout(resolve, defaultConfig.delay));
      return { ...createMockCustomer({ id }), ...data };
    }
  };

  const ml: MockMLService = {
    predictRisk: mockRiskPrediction,
    predictChurn: mockChurnPrediction,
    getModelMetrics: async () => {
      performance.requestCount++;
      return {
        accuracy: 0.95,
        precision: 0.92,
        recall: 0.89,
        f1Score: 0.91
      };
    },
    retrainModel: async () => {
      performance.requestCount++;
      await new Promise(resolve => setTimeout(resolve, defaultConfig.delay * 2));
    }
  };

  return {
    auth,
    customers,
    ml,
    performance,
    cleanup
  };
}

/**
 * Resets all mock services and cleans up resources
 */
export async function resetMockServices(): Promise<void> {
  const services = createMockServices();
  services.performance.reset();
  await services.cleanup.cleanupAll();
}