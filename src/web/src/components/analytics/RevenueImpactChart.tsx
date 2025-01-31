import React from 'react'; // ^18.0.0
import { useSelector } from 'react-redux'; // ^8.1.0
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'; // ^2.7.0
import classNames from 'classnames'; // ^2.3.2
import ChartContainer from './ChartContainer';
import { MetricType } from '../../types/metrics';
import { selectAggregateMetrics } from '../../store/metrics/selectors';
import { useTheme } from '../../hooks/useTheme';

interface RevenueImpactChartProps {
  className?: string;
  height?: number;
  ariaLabel?: string;
}

/**
 * Revenue Impact Chart Component
 * Visualizes financial effects from customer churn and expansion opportunities
 * Implements WCAG 2.1 Level AA compliance for accessibility
 */
const RevenueImpactChart: React.FC<RevenueImpactChartProps> = React.memo(({
  className,
  height = 300,
  ariaLabel = 'Revenue Impact Chart'
}) => {
  const { theme } = useTheme();
  const metrics = useSelector(selectAggregateMetrics);

  // Extract revenue impact metrics
  const revenueMetric = metrics[MetricType.REVENUE_IMPACT];

  // Format currency values
  const formatCurrency = React.useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }, []);

  // Calculate percentage changes
  const percentChange = React.useMemo(() => {
    if (!revenueMetric?.previous || !revenueMetric?.current) return 0;
    return ((revenueMetric.current - revenueMetric.previous) / revenueMetric.previous) * 100;
  }, [revenueMetric]);

  // Prepare chart data
  const chartData = React.useMemo(() => {
    if (!revenueMetric) return [];

    return [
      {
        name: 'Previous',
        value: revenueMetric.previous,
        target: revenueMetric.target
      },
      {
        name: 'Current',
        value: revenueMetric.current,
        target: revenueMetric.target
      }
    ];
  }, [revenueMetric]);

  // Generate theme-aware colors
  const colors = React.useMemo(() => ({
    area: theme.colors.chartPrimary,
    target: theme.colors.success,
    grid: theme.mode === 'dark' ? theme.colors.border : theme.colors.divider,
    text: theme.colors.text,
    tooltip: theme.colors.surface
  }), [theme]);

  // Custom tooltip component
  const CustomTooltip = React.useCallback(({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;

    return (
      <div 
        className={classNames(
          'bg-surface p-3 rounded shadow-lg border border-border',
          { 'dark:bg-surface-dark': theme.mode === 'dark' }
        )}
        role="tooltip"
      >
        <p className="font-semibold mb-1">{payload[0].payload.name}</p>
        <p>Value: {formatCurrency.format(payload[0].value)}</p>
        <p>Target: {formatCurrency.format(payload[0].payload.target)}</p>
      </div>
    );
  }, [theme.mode, formatCurrency]);

  return (
    <ChartContainer
      title="Revenue Impact Analysis"
      className={className}
      height={height}
      error={!revenueMetric ? 'No revenue impact data available' : undefined}
    >
      <div 
        className="relative w-full h-full"
        role="region"
        aria-label={ariaLabel}
      >
        {/* Current vs Target Summary */}
        <div className="absolute top-0 right-0 p-4 text-right">
          <p className="text-sm text-textSecondary mb-1">
            Current vs Target
          </p>
          <p className={classNames(
            'font-bold text-lg',
            percentChange >= 0 ? 'text-success' : 'text-danger'
          )}>
            {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
          </p>
        </div>

        {/* Main Chart */}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="5%" 
                  stopColor={colors.area} 
                  stopOpacity={0.8}
                />
                <stop 
                  offset="95%" 
                  stopColor={colors.area} 
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={colors.grid}
              strokeOpacity={0.5}
            />
            
            <XAxis
              dataKey="name"
              stroke={colors.text}
              tick={{ fill: colors.text }}
            />
            
            <YAxis
              stroke={colors.text}
              tick={{ fill: colors.text }}
              tickFormatter={formatCurrency.format}
            />
            
            <Tooltip
              content={CustomTooltip}
              cursor={{ strokeDasharray: '3 3' }}
            />
            
            <Legend 
              wrapperStyle={{ color: colors.text }}
              formatter={(value) => <span style={{ color: colors.text }}>{value}</span>}
            />
            
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors.area}
              fillOpacity={1}
              fill="url(#revenueGradient)"
              name="Revenue"
              isAnimationActive={!theme.mode.includes('contrast')}
            />
            
            <Area
              type="monotone"
              dataKey="target"
              stroke={colors.target}
              fill="none"
              strokeDasharray="5 5"
              name="Target"
              isAnimationActive={!theme.mode.includes('contrast')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
});

RevenueImpactChart.displayName = 'RevenueImpactChart';

export default RevenueImpactChart;