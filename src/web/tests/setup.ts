// @testing-library/jest-dom v6.0.0
import '@testing-library/jest-dom';
// @testing-library/react v14.0.0
import { configure } from '@testing-library/react';
// jest-environment-jsdom v29.0.0
import 'jest-environment-jsdom';

/**
 * Configure React Testing Library
 */
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
  computedStyleSupportsPseudoElements: true,
  defaultHidden: true,
  throwSuggestions: true,
});

/**
 * Setup Jest DOM environment and extend matchers
 */
function setupJestDom(): void {
  // Track unhandled errors/rejections
  const originalError = console.error;
  console.error = (...args) => {
    if (
      /Warning: ReactDOM.render is no longer supported/i.test(args[0]) ||
      /Warning: React.createFactory\(\) is deprecated/i.test(args[0])
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  // Configure performance monitoring
  if (!window.performance) {
    window.performance = {
      mark: jest.fn(),
      measure: jest.fn(),
      clearMarks: jest.fn(),
      clearMeasures: jest.fn(),
      getEntriesByName: jest.fn(),
      getEntriesByType: jest.fn(),
      now: jest.fn(() => Date.now()),
    } as unknown as Performance;
  }

  // Memory leak detection
  const memoryLeakDetector = {
    listeners: new Set(),
    add: (listener: any) => memoryLeakDetector.listeners.add(listener),
    remove: (listener: any) => memoryLeakDetector.listeners.delete(listener),
    reset: () => memoryLeakDetector.listeners.clear(),
  };
  (global as any).__MEMORY_LEAK_DETECTOR__ = memoryLeakDetector;
}

/**
 * Setup global browser API mocks
 */
function setupGlobalMocks(): void {
  // Configure React testing environment
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  // Mock matchMedia
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

  // Mock ResizeObserver
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock IntersectionObserver
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }));

  // Mock security boundaries
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });

  // Mock fetch API
  global.fetch = jest.fn();
}

/**
 * Cleanup test environment after each test
 */
function cleanupTestEnvironment(): void {
  // Reset all mocks
  jest.clearAllMocks();
  jest.clearAllTimers();
  
  // Clear localStorage and sessionStorage
  window.localStorage.clear();
  window.sessionStorage.clear();
  
  // Reset memory leak detector
  (global as any).__MEMORY_LEAK_DETECTOR__?.reset();
  
  // Clear performance marks/measures
  window.performance.clearMarks();
  window.performance.clearMeasures();
  
  // Reset document body
  document.body.innerHTML = '';
  
  // Clear any registered event listeners
  const events = ['resize', 'scroll', 'mousemove', 'keydown', 'keyup'];
  events.forEach(event => {
    window.removeEventListener(event, jest.fn());
  });
}

// Initialize test environment
setupJestDom();
setupGlobalMocks();

// Configure global afterEach hook
afterEach(() => {
  cleanupTestEnvironment();
});

// Export test utilities for use in test files
export {
  setupJestDom,
  setupGlobalMocks,
  cleanupTestEnvironment,
};