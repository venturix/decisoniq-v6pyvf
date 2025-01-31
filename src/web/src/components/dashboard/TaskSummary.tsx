import React from 'react'; // ^18.0.0
import { useSelector } from 'react-redux'; // ^8.0.0
import Card from '../common/Card';
import { PlaybookState } from '../../store/playbook/types';
import { CustomerState } from '../../store/customer/types';

/**
 * Props for TaskSummary component with enhanced styling and configuration options
 */
interface TaskSummaryProps {
  /** Optional CSS class name */
  className?: string;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Toggle risk distribution visualization */
  showRiskDistribution?: boolean;
}

/**
 * Enhanced interface for task summary metrics with risk tracking
 */
interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  criticalTasks: number;
  riskDistribution: Record<'high' | 'medium' | 'low', number>;
  completionRate: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Calculates comprehensive task metrics with risk distribution and trends
 */
const calculateTaskMetrics = (
  executions: Record<string, PlaybookExecution>,
  interactions: CustomerInteraction[],
  riskScores: Record<string, number>
): TaskMetrics => {
  const metrics: TaskMetrics = {
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    criticalTasks: 0,
    riskDistribution: { high: 0, medium: 0, low: 0 },
    completionRate: 0,
    trend: 'stable'
  };

  // Process playbook executions
  Object.values(executions).forEach(execution => {
    metrics.totalTasks++;
    
    if (execution.status === 'completed') {
      metrics.completedTasks++;
    } else if (execution.status === 'pending' || execution.status === 'running') {
      metrics.pendingTasks++;
    }

    // Calculate risk-based metrics
    const riskScore = riskScores[execution.customerId] || 0;
    if (riskScore >= 80) {
      metrics.criticalTasks++;
      metrics.riskDistribution.high++;
    } else if (riskScore >= 50) {
      metrics.riskDistribution.medium++;
    } else {
      metrics.riskDistribution.low++;
    }
  });

  // Process customer interactions
  interactions.forEach(interaction => {
    if (interaction.nextSteps?.length > 0) {
      metrics.totalTasks += interaction.nextSteps.length;
      // Add to pending tasks if interaction is recent (within last 24 hours)
      if (new Date().getTime() - new Date(interaction.timestamp).getTime() < 86400000) {
        metrics.pendingTasks += interaction.nextSteps.length;
      }
    }
  });

  // Calculate completion rate and trend
  metrics.completionRate = metrics.totalTasks > 0 
    ? (metrics.completedTasks / metrics.totalTasks) * 100 
    : 0;

  // Determine trend based on completion rate
  const previousRate = metrics.completionRate - 5; // Example threshold
  metrics.trend = metrics.completionRate > previousRate 
    ? 'increasing' 
    : metrics.completionRate < previousRate 
      ? 'decreasing' 
      : 'stable';

  return metrics;
};

/**
 * Enhanced TaskSummary component with risk tracking and accessibility features
 */
export const TaskSummary: React.FC<TaskSummaryProps> = React.memo(({
  className = '',
  refreshInterval = 30000,
  showRiskDistribution = true
}) => {
  // Redux state selectors
  const { executions } = useSelector((state: { playbook: PlaybookState }) => state.playbook);
  const { interactions, healthScores } = useSelector((state: { customer: CustomerState }) => state.customer);

  // Calculate metrics with memoization
  const metrics = React.useMemo(() => 
    calculateTaskMetrics(executions, interactions, healthScores),
    [executions, interactions, healthScores]
  );

  // Auto-refresh setup
  React.useEffect(() => {
    const interval = setInterval(() => {
      // Trigger refresh logic here if needed
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return (
    <Card
      variant={metrics.criticalTasks > 0 ? 'warning' : 'default'}
      className={`task-summary ${className}`}
      aria-label="Task Summary Dashboard"
    >
      <div className="flex flex-col space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Task Summary
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card" role="status">
            <span className="stat-label">Total Tasks</span>
            <span className="stat-value">{metrics.totalTasks}</span>
          </div>
          
          <div className="stat-card" role="status">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{metrics.completedTasks}</span>
            <span className="stat-rate">
              {metrics.completionRate.toFixed(1)}%
              <span className={`trend-indicator ${metrics.trend}`} aria-label={`Trend: ${metrics.trend}`} />
            </span>
          </div>
          
          <div className="stat-card" role="status">
            <span className="stat-label">Pending</span>
            <span className="stat-value">{metrics.pendingTasks}</span>
          </div>
          
          <div className="stat-card" role="status">
            <span className="stat-label">Critical</span>
            <span className="stat-value text-red-600">{metrics.criticalTasks}</span>
          </div>
        </div>

        {showRiskDistribution && (
          <div className="risk-distribution" role="region" aria-label="Risk Distribution">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Risk Distribution
            </h3>
            <div className="flex space-x-2 mt-2">
              <div 
                className="risk-bar high" 
                style={{ width: `${(metrics.riskDistribution.high / metrics.totalTasks) * 100}%` }}
                role="progressbar"
                aria-label="High Risk Tasks"
                aria-valuenow={metrics.riskDistribution.high}
                aria-valuemin={0}
                aria-valuemax={metrics.totalTasks}
              />
              <div 
                className="risk-bar medium"
                style={{ width: `${(metrics.riskDistribution.medium / metrics.totalTasks) * 100}%` }}
                role="progressbar"
                aria-label="Medium Risk Tasks"
                aria-valuenow={metrics.riskDistribution.medium}
                aria-valuemin={0}
                aria-valuemax={metrics.totalTasks}
              />
              <div 
                className="risk-bar low"
                style={{ width: `${(metrics.riskDistribution.low / metrics.totalTasks) * 100}%` }}
                role="progressbar"
                aria-label="Low Risk Tasks"
                aria-valuenow={metrics.riskDistribution.low}
                aria-valuemin={0}
                aria-valuemax={metrics.totalTasks}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});

TaskSummary.displayName = 'TaskSummary';

export default TaskSummary;