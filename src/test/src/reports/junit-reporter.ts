import { Reporter } from '@jest/reporters'; // v29.6.0
import { TestResult } from '@jest/test-result'; // v29.6.0
import { create } from 'xmlbuilder2'; // v3.1.1
import { ensureDir, writeFile } from 'fs-extra'; // v11.1.1
import { join } from 'path';
import { TestConfig, TestStatus } from '../types/test';

/**
 * Custom JUnit XML reporter for generating standardized test execution reports
 * compatible with CI/CD systems and test management tools.
 */
export class JUnitReporter extends Reporter {
  private outputDirectory: string;
  private testResults: Map<string, TestResult>;
  private reportMetrics: {
    tests: number;
    failures: number;
    errors: number;
    skipped: number;
    time: number;
  };
  private xmlBuilder: any;
  private startTime: number;
  private debug: boolean;

  /**
   * Initialize the JUnit reporter with configuration
   */
  constructor(config: TestConfig) {
    super(config);
    this.outputDirectory = config.reportPath || 'test-reports/junit';
    this.testResults = new Map();
    this.reportMetrics = {
      tests: 0,
      failures: 0,
      errors: 0,
      skipped: 0,
      time: 0
    };
    this.xmlBuilder = create({ version: '1.0', encoding: 'UTF-8' });
    this.startTime = Date.now();
    this.debug = process.env.DEBUG === 'true';
  }

  /**
   * Handle test suite execution start
   */
  async onRunStart(): Promise<void> {
    this.testResults.clear();
    this.reportMetrics = {
      tests: 0,
      failures: 0,
      errors: 0,
      skipped: 0,
      time: 0
    };

    await ensureDir(this.outputDirectory);

    // Initialize XML document with JUnit schema
    this.xmlBuilder = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('testsuites')
      .ele('testsuite', {
        name: 'Customer Success AI Platform Tests',
        timestamp: new Date().toISOString()
      });

    if (this.debug) {
      console.log('JUnit Reporter initialized');
      console.log(`Output directory: ${this.outputDirectory}`);
    }
  }

  /**
   * Process individual test results
   */
  async onTestResult(test: any, testResult: TestResult): Promise<void> {
    this.testResults.set(testResult.testFilePath, testResult);
    
    // Update metrics
    this.reportMetrics.tests += testResult.numPassingTests + testResult.numFailingTests + testResult.numPendingTests;
    this.reportMetrics.failures += testResult.numFailingTests;
    this.reportMetrics.skipped += testResult.numPendingTests;
    this.reportMetrics.time += testResult.perfStats.runtime / 1000;

    // Add test cases to XML
    testResult.testResults.forEach(result => {
      const testCase = this.xmlBuilder.ele('testcase', {
        classname: testResult.testFilePath,
        name: result.title,
        time: result.duration / 1000
      });

      if (result.status === 'failed') {
        testCase.ele('failure', {
          message: result.failureMessages[0],
          type: 'AssertionError'
        }).txt(result.failureMessages.join('\n'));
      }

      if (result.status === 'pending') {
        testCase.ele('skipped');
      }

      // Add system-out for test output
      if (result.console && result.console.length > 0) {
        testCase.ele('system-out').txt(result.console.map(entry => entry.message).join('\n'));
      }
    });

    if (this.debug) {
      console.log(`Processed test result: ${testResult.testFilePath}`);
      console.log(`Tests: ${testResult.numPassingTests + testResult.numFailingTests + testResult.numPendingTests}`);
    }
  }

  /**
   * Finalize test execution and generate report
   */
  async onRunComplete(): Promise<void> {
    // Add summary attributes to testsuite
    this.xmlBuilder.att({
      tests: this.reportMetrics.tests,
      failures: this.reportMetrics.failures,
      errors: this.reportMetrics.errors,
      skipped: this.reportMetrics.skipped,
      time: this.reportMetrics.time,
      timestamp: new Date().toISOString()
    });

    // Add environment information
    const properties = this.xmlBuilder.ele('properties');
    properties.ele('property', { name: 'environment', value: process.env.NODE_ENV });
    properties.ele('property', { name: 'jest.version', value: process.env.JEST_VERSION });
    properties.ele('property', { name: 'platform', value: process.platform });

    // Generate final XML
    const xml = this.xmlBuilder.end({ prettyPrint: true });

    // Create timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `junit-report-${timestamp}.xml`;
    const outputPath = join(this.outputDirectory, filename);

    // Write report file
    await writeFile(outputPath, xml);

    if (this.debug) {
      console.log('JUnit report generated successfully');
      console.log(`Report location: ${outputPath}`);
      console.log('Final metrics:', this.reportMetrics);
    }
  }

  /**
   * Format a test result as a JUnit test case
   */
  private formatTestCase(result: any): object {
    const testCase = {
      '@classname': result.ancestorTitles.join(' '),
      '@name': result.title,
      '@time': result.duration / 1000
    };

    if (result.status === 'failed') {
      return {
        ...testCase,
        failure: {
          '@message': result.failureMessages[0],
          '@type': 'AssertionError',
          '#text': result.failureMessages.join('\n')
        }
      };
    }

    if (result.status === 'pending') {
      return {
        ...testCase,
        skipped: {}
      };
    }

    return testCase;
  }
}