import { Reporter } from '@jest/reporters'; // v29.6.0
import { TestResult } from '@jest/test-result'; // v29.6.0
import { ensureDir, writeFile } from 'fs-extra'; // v11.1.1
import { join } from 'path';
import { TestFixture } from '../types/test';
import { securityRules } from '../config/security-rules';
import { JUnitReporter } from './junit-reporter';

/**
 * Enhanced configuration options for security reporter
 */
interface SecurityReportOptions {
  outputDir: string;
  includeMetrics: boolean;
  severityThreshold: SecuritySeverity;
  performanceTracking: boolean;
  complianceValidation: boolean;
  trendAnalysis: boolean;
}

/**
 * Security severity levels
 */
type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Security test categories
 */
type SecurityCategory = 'authentication' | 'authorization' | 'data_protection' | 'network' | 'compliance';

/**
 * Test execution status
 */
type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';

/**
 * Compliance validation status
 */
type ComplianceStatus = 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';

/**
 * Performance metrics tracking
 */
interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}

/**
 * Trend analysis data
 */
interface TrendData {
  previousResults: number[];
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
}

/**
 * Security violation details
 */
interface SecurityViolation {
  ruleId: string;
  severity: SecuritySeverity;
  message: string;
  location: string;
  context: Record<string, unknown>;
}

/**
 * Enhanced structure for security test results
 */
interface SecurityTestResult {
  ruleId: string;
  category: SecurityCategory;
  severity: SecuritySeverity;
  status: TestStatus;
  details: string;
  complianceStatus: ComplianceStatus;
  performanceMetrics: PerformanceMetrics;
  trendIndicators: TrendData;
  violations: SecurityViolation[];
}

/**
 * Enhanced security metrics tracking
 */
type SecurityMetrics = {
  totalTests: number;
  passed: number;
  failed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  performanceIssues: number;
  complianceViolations: number;
  trendIndicators: TrendData;
};

/**
 * Enhanced custom reporter for security test execution results
 */
export class SecurityReporter extends Reporter {
  private outputDirectory: string;
  private securityResults: Map<string, SecurityTestResult>;
  private metrics: SecurityMetrics;
  private performanceData: Map<string, PerformanceMetrics>;
  private complianceStatus: Map<string, ComplianceStatus>;
  private trendAnalysis: Map<string, TrendData>;
  private junitReporter: JUnitReporter;
  private startTime: number;
  private options: SecurityReportOptions;

  constructor(options: SecurityReportOptions) {
    super();
    this.outputDirectory = options.outputDir;
    this.options = options;
    this.securityResults = new Map();
    this.performanceData = new Map();
    this.complianceStatus = new Map();
    this.trendAnalysis = new Map();
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.junitReporter = new JUnitReporter({ reportPath: join(options.outputDir, 'junit') });
  }

  /**
   * Initialize security metrics tracking
   */
  private initializeMetrics(): SecurityMetrics {
    return {
      totalTests: 0,
      passed: 0,
      failed: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      performanceIssues: 0,
      complianceViolations: 0,
      trendIndicators: {
        previousResults: [],
        trend: 'stable',
        changeRate: 0
      }
    };
  }

  /**
   * Enhanced handler for test suite start with security context
   */
  async onRunStart(): Promise<void> {
    await ensureDir(this.outputDirectory);
    this.securityResults.clear();
    this.metrics = this.initializeMetrics();
    this.startTime = Date.now();

    if (this.options.performanceTracking) {
      this.initializePerformanceTracking();
    }

    await this.junitReporter.onRunStart();
  }

  /**
   * Initialize performance tracking
   */
  private initializePerformanceTracking(): void {
    this.performanceData.clear();
    const initialMetrics: PerformanceMetrics = {
      executionTime: 0,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user,
      networkLatency: 0
    };
    this.performanceData.set('initial', initialMetrics);
  }

  /**
   * Enhanced handler for individual test completion
   */
  async onTestResult(test: any, testResult: TestResult): Promise<void> {
    const securityResult = await this.processSecurityTest(testResult);
    this.securityResults.set(testResult.testFilePath, securityResult);
    this.updateMetrics(securityResult);

    if (this.options.performanceTracking) {
      this.trackPerformanceMetrics(testResult);
    }

    if (this.options.complianceValidation) {
      await this.validateCompliance(securityResult);
    }

    if (this.options.trendAnalysis) {
      this.updateTrendAnalysis(securityResult);
    }

    await this.junitReporter.onTestResult(test, testResult);
  }

  /**
   * Process security test results
   */
  private async processSecurityTest(testResult: TestResult): Promise<SecurityTestResult> {
    const violations: SecurityViolation[] = [];
    let severity: SecuritySeverity = 'low';

    testResult.testResults.forEach(result => {
      if (result.status === 'failed') {
        const violation = this.parseSecurityViolation(result);
        violations.push(violation);
        severity = this.escalateSeverity(severity, violation.severity);
      }
    });

    return {
      ruleId: testResult.testFilePath,
      category: this.determineSecurityCategory(testResult),
      severity,
      status: this.determineTestStatus(testResult),
      details: this.generateTestDetails(testResult),
      complianceStatus: this.evaluateCompliance(violations),
      performanceMetrics: this.getPerformanceMetrics(testResult),
      trendIndicators: this.calculateTrends(testResult),
      violations
    };
  }

  /**
   * Generate comprehensive security report
   */
  async generateSecurityReport(): Promise<string> {
    const reportData = {
      summary: this.generateSummary(),
      details: this.generateDetailedResults(),
      compliance: this.generateComplianceReport(),
      performance: this.generatePerformanceReport(),
      trends: this.generateTrendReport(),
      recommendations: this.generateRecommendations()
    };

    const report = JSON.stringify(reportData, null, 2);
    const outputPath = join(this.outputDirectory, `security-report-${Date.now()}.json`);
    await writeFile(outputPath, report);

    return outputPath;
  }

  /**
   * Generate security report summary
   */
  private generateSummary(): object {
    return {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      metrics: this.metrics,
      criticalIssues: this.metrics.critical,
      complianceStatus: this.evaluateOverallCompliance(),
      riskLevel: this.calculateRiskLevel()
    };
  }

  /**
   * Generate detailed test results
   */
  private generateDetailedResults(): object {
    const details: Record<string, unknown> = {};
    this.securityResults.forEach((result, path) => {
      details[path] = {
        severity: result.severity,
        status: result.status,
        violations: result.violations,
        compliance: result.complianceStatus,
        performance: result.performanceMetrics
      };
    });
    return details;
  }

  /**
   * Update security metrics based on test results
   */
  private updateMetrics(result: SecurityTestResult): void {
    this.metrics.totalTests++;
    if (result.status === 'passed') this.metrics.passed++;
    if (result.status === 'failed') this.metrics.failed++;

    switch (result.severity) {
      case 'critical':
        this.metrics.critical++;
        break;
      case 'high':
        this.metrics.high++;
        break;
      case 'medium':
        this.metrics.medium++;
        break;
      case 'low':
        this.metrics.low++;
        break;
    }

    if (result.performanceMetrics.executionTime > 1000) {
      this.metrics.performanceIssues++;
    }

    if (result.complianceStatus === 'non_compliant') {
      this.metrics.complianceViolations++;
    }
  }

  /**
   * Calculate overall risk level based on test results
   */
  private calculateRiskLevel(): SecuritySeverity {
    if (this.metrics.critical > 0) return 'critical';
    if (this.metrics.high > 0) return 'high';
    if (this.metrics.medium > 0) return 'medium';
    return 'low';
  }

  /**
   * Parse security violation from test result
   */
  private parseSecurityViolation(result: any): SecurityViolation {
    return {
      ruleId: result.title,
      severity: this.determineSeverity(result),
      message: result.failureMessages[0],
      location: result.location?.path || 'unknown',
      context: result.context || {}
    };
  }

  /**
   * Determine security category based on test result
   */
  private determineSecurityCategory(testResult: TestResult): SecurityCategory {
    const path = testResult.testFilePath.toLowerCase();
    if (path.includes('auth')) return 'authentication';
    if (path.includes('data')) return 'data_protection';
    if (path.includes('network')) return 'network';
    if (path.includes('compliance')) return 'compliance';
    return 'authorization';
  }

  /**
   * Determine test status from test result
   */
  private determineTestStatus(testResult: TestResult): TestStatus {
    if (testResult.numFailingTests > 0) return 'failed';
    if (testResult.numPendingTests > 0) return 'pending';
    if (testResult.numPassingTests > 0) return 'passed';
    return 'skipped';
  }

  /**
   * Get performance metrics for test result
   */
  private getPerformanceMetrics(testResult: TestResult): PerformanceMetrics {
    return {
      executionTime: testResult.perfStats.runtime,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user,
      networkLatency: testResult.perfStats.slow || 0
    };
  }

  /**
   * Calculate trend indicators for test result
   */
  private calculateTrends(testResult: TestResult): TrendData {
    const previousResults = this.trendAnalysis.get(testResult.testFilePath)?.previousResults || [];
    const currentValue = testResult.numPassingTests / (testResult.numPassingTests + testResult.numFailingTests);
    
    previousResults.push(currentValue);
    if (previousResults.length > 10) previousResults.shift();

    const trend = this.calculateTrendDirection(previousResults);
    const changeRate = this.calculateChangeRate(previousResults);

    return {
      previousResults,
      trend,
      changeRate
    };
  }

  /**
   * Calculate trend direction from historical data
   */
  private calculateTrendDirection(data: number[]): 'improving' | 'stable' | 'degrading' {
    if (data.length < 2) return 'stable';
    const recent = data.slice(-3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previous = data[data.length - 4] || avg;
    
    if (avg > previous + 0.1) return 'improving';
    if (avg < previous - 0.1) return 'degrading';
    return 'stable';
  }

  /**
   * Calculate rate of change in trend data
   */
  private calculateChangeRate(data: number[]): number {
    if (data.length < 2) return 0;
    const recent = data.slice(-2);
    return (recent[1] - recent[0]) / recent[0] * 100;
  }
}