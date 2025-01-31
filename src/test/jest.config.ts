/**
 * Jest Configuration for Customer Success AI Platform
 * Version: Jest 29.5.0
 * 
 * This configuration file sets up the test environment for the Customer Success AI Platform,
 * including test runner settings, coverage reporting, module resolution, and environment setup.
 */

import type { Config } from '@jest/types'; // @types/jest@29.5.0

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test file discovery
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx)',
    '**/?(*.)+(spec|test).+(ts|tsx)'
  ],

  // TypeScript transformation
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Module path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/src/test/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1'
  },

  // Test setup file
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],

  // Code coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**/*',
    '!src/**/index.{ts,tsx}',
    '!src/types/**/*',
    '!src/generated/**/*',
    '!src/migrations/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'jest-junit',
    'jest-sonar'
  ],

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/src/test/tsconfig.json'
    }
  },

  // File extensions to consider
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],

  // Test execution configuration
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: '50%',
  errorOnDeprecated: true,

  // Paths to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ]
};

export default config;