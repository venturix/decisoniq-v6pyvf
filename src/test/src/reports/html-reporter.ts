import { Reporter } from '@jest/reporters'; // v29.6.0
import { TestResult } from '@jest/test-result'; // v29.6.0
import handlebars from 'handlebars'; // v4.7.8
import fs from 'fs-extra'; // v11.1.1
import { Chart } from 'chart.js'; // v4.4.0
import path from 'path';

// Internal imports
import { TestConfig, TestStatus } from '../types/test';

/**
 * Interface for reporter configuration options
 */
interface ReporterConfig {
  outputDir?: string;
  includeConsoleLog?: boolean;
  enableHistoricalData?: boolean;
  customTemplates?: string[];
  chartOptions?: Record<string, any>;
}

/**
 * Interface for test execution metrics
 */
interface TestMetrics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage: number;
  timestamp: Date;
}

/**
 * Interface for historical test data
 */
interface HistoricalData {
  metrics: TestMetrics[];
  trends: Record<string, number[]>;
  coverage: Record<string, number[]>;
}

/**
 * Custom HTML reporter for generating comprehensive test execution reports
 */
export class HTMLReporter extends Reporter {
  private outputDirectory: string;
  private testResults: Map<string, TestResult>;
  private reportMetrics: TestMetrics;
  private templateEngine: typeof handlebars;
  private chartConfigs: Record<string, any>;
  private historicalData: HistoricalData;

  constructor(config: ReporterConfig = {}) {
    super();
    this.outputDirectory = config.outputDir || 'test-reports';
    this.testResults = new Map();
    this.reportMetrics = this.initializeMetrics();
    this.templateEngine = this.configureTemplateEngine();
    this.chartConfigs = this.initializeChartConfigs(config.chartOptions);
    this.historicalData = this.loadHistoricalData();
  }

  /**
   * Handles test suite execution start
   */
  async onRunStart(): Promise<void> {
    await this.prepareOutputDirectory();
    this.reportMetrics = this.initializeMetrics();
    this.testResults.clear();
    await this.copyAssets();
  }

  /**
   * Processes individual test results
   */
  async onTestResult(test: Test, testResult: TestResult): Promise<void> {
    this.testResults.set(test.path, testResult);
    this.updateMetrics(testResult);
    await this.generateIncrementalCharts();
  }

  /**
   * Finalizes test execution and generates report
   */
  async onRunComplete(): Promise<void> {
    const report = await this.generateHTML();
    await this.saveReport(report);
    await this.updateHistoricalData();
    await this.generateCharts();
    await this.cleanup();
  }

  /**
   * Initializes test metrics tracking
   */
  private initializeMetrics(): TestMetrics {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      coverage: 0,
      timestamp: new Date()
    };
  }

  /**
   * Configures Handlebars template engine
   */
  private configureTemplateEngine(): typeof handlebars {
    const engine = handlebars.create();
    
    // Register custom helpers
    engine.registerHelper('formatDate', (date: Date) => {
      return date.toLocaleDateString();
    });

    engine.registerHelper('formatDuration', (ms: number) => {
      return `${(ms / 1000).toFixed(2)}s`;
    });

    engine.registerHelper('formatPercentage', (value: number) => {
      return `${(value * 100).toFixed(1)}%`;
    });

    return engine;
  }

  /**
   * Initializes Chart.js configurations
   */
  private initializeChartConfigs(options: Record<string, any> = {}): Record<string, any> {
    return {
      metrics: {
        type: 'doughnut',
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'right' },
            title: { display: true, text: 'Test Results' }
          },
          ...options.metrics
        }
      },
      trends: {
        type: 'line',
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Historical Trends' }
          },
          ...options.trends
        }
      },
      coverage: {
        type: 'bar',
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Code Coverage' }
          },
          ...options.coverage
        }
      }
    };
  }

  /**
   * Prepares output directory structure
   */
  private async prepareOutputDirectory(): Promise<void> {
    await fs.ensureDir(this.outputDirectory);
    await fs.ensureDir(path.join(this.outputDirectory, 'assets'));
    await fs.ensureDir(path.join(this.outputDirectory, 'data'));
  }

  /**
   * Copies static assets to output directory
   */
  private async copyAssets(): Promise<void> {
    const assetsDir = path.join(__dirname, '../templates/assets');
    await fs.copy(assetsDir, path.join(this.outputDirectory, 'assets'));
  }

  /**
   * Updates test metrics with new results
   */
  private updateMetrics(testResult: TestResult): void {
    this.reportMetrics.total += testResult.numTotalTests;
    this.reportMetrics.passed += testResult.numPassingTests;
    this.reportMetrics.failed += testResult.numFailingTests;
    this.reportMetrics.skipped += testResult.numPendingTests;
    this.reportMetrics.duration += testResult.perfStats.runtime;
    this.reportMetrics.coverage = this.calculateCoverage(testResult);
  }

  /**
   * Calculates test coverage percentage
   */
  private calculateCoverage(testResult: TestResult): number {
    if (!testResult.coverage) return 0;
    const coverage = testResult.coverage.global;
    return (coverage.statements.covered / coverage.statements.total) || 0;
  }

  /**
   * Generates HTML report content
   */
  private async generateHTML(): Promise<string> {
    const template = await fs.readFile(
      path.join(__dirname, '../templates/report.hbs'),
      'utf-8'
    );

    const compiledTemplate = this.templateEngine.compile(template);
    return compiledTemplate({
      metrics: this.reportMetrics,
      results: Array.from(this.testResults.entries()),
      charts: await this.generateCharts(),
      historical: this.historicalData,
      timestamp: new Date()
    });
  }

  /**
   * Generates interactive charts for metrics visualization
   */
  private async generateCharts(): Promise<Record<string, any>> {
    return {
      results: {
        ...this.chartConfigs.metrics,
        data: {
          labels: ['Passed', 'Failed', 'Skipped'],
          datasets: [{
            data: [
              this.reportMetrics.passed,
              this.reportMetrics.failed,
              this.reportMetrics.skipped
            ],
            backgroundColor: ['#4caf50', '#f44336', '#ff9800']
          }]
        }
      },
      trends: {
        ...this.chartConfigs.trends,
        data: {
          labels: this.historicalData.metrics.map(m => 
            m.timestamp.toLocaleDateString()
          ),
          datasets: [{
            label: 'Pass Rate',
            data: this.historicalData.trends.passRate,
            borderColor: '#4caf50'
          }]
        }
      },
      coverage: {
        ...this.chartConfigs.coverage,
        data: {
          labels: ['Statements', 'Branches', 'Functions', 'Lines'],
          datasets: [{
            label: 'Coverage',
            data: Object.values(this.historicalData.coverage),
            backgroundColor: '#2196f3'
          }]
        }
      }
    };
  }

  /**
   * Saves generated report to file system
   */
  private async saveReport(report: string): Promise<void> {
    const outputPath = path.join(this.outputDirectory, 'index.html');
    await fs.writeFile(outputPath, report, 'utf-8');
  }

  /**
   * Loads historical test execution data
   */
  private loadHistoricalData(): HistoricalData {
    try {
      const dataPath = path.join(this.outputDirectory, 'data/historical.json');
      return fs.readJSONSync(dataPath);
    } catch {
      return {
        metrics: [],
        trends: { passRate: [] },
        coverage: {}
      };
    }
  }

  /**
   * Updates historical data with current execution results
   */
  private async updateHistoricalData(): Promise<void> {
    this.historicalData.metrics.push(this.reportMetrics);
    this.historicalData.trends.passRate.push(
      this.reportMetrics.passed / this.reportMetrics.total
    );

    const dataPath = path.join(this.outputDirectory, 'data/historical.json');
    await fs.writeJSON(dataPath, this.historicalData, { spaces: 2 });
  }

  /**
   * Generates incremental charts during test execution
   */
  private async generateIncrementalCharts(): Promise<void> {
    // Implementation for real-time chart updates
  }

  /**
   * Performs cleanup after report generation
   */
  private async cleanup(): Promise<void> {
    // Cleanup temporary files and resources
  }
}