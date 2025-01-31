import React from 'react'; // ^18.0.0
import { Chart } from 'chart.js'; // ^4.0.0
import { useQuery } from '@tanstack/react-query'; // ^4.0.0
import useWebSocket from 'react-use-websocket'; // ^4.3.1
import ChartContainer from './ChartContainer';
import { getCustomerHealthScore } from '../../lib/api/customer';
import type { Customer } from '../../types/customer';
import { useTheme } from '../../lib/blitzy/theme';

/**
 * Props interface for CustomerHealthChart component
 */
interface CustomerHealthChartProps {
  /** ID of customer to display health data for */
  customerId: string;
  /** Time range in days for health score history */
  timeRange?: number;
  /** Chart height in pixels */
  height?: number;
  /** Additional CSS classes */
  className?: string;
  /** Real-time update interval in milliseconds */
  refreshInterval?: number;
}

/**
 * Formats raw health score data for accessible chart display
 */
const formatHealthData = (data: number[], labels: string[]) => {
  const { theme } = useTheme();

  return {
    labels,
    datasets: [
      {
        label: 'Health Score',
        data,
        borderColor: theme.colors.chartPrimary,
        backgroundColor: `${theme.colors.chartPrimary}20`,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: theme.colors.chartPrimary,
        borderWidth: 2,
      },
    ],
  };
};

/**
 * Chart configuration with accessibility and theme support
 */
const getChartConfig = (theme: any) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index',
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        color: theme.colors.text,
        font: {
          size: 12,
          weight: '500',
        },
      },
    },
    tooltip: {
      enabled: true,
      backgroundColor: theme.colors.surface,
      titleColor: theme.colors.text,
      bodyColor: theme.colors.textSecondary,
      borderColor: theme.colors.border,
      borderWidth: 1,
      padding: 12,
      cornerRadius: 4,
      displayColors: false,
      callbacks: {
        label: (context: any) => `Health Score: ${context.raw}`,
      },
    },
  },
  scales: {
    x: {
      grid: {
        color: theme.colors.divider,
        drawBorder: false,
      },
      ticks: {
        color: theme.colors.textSecondary,
        font: {
          size: 11,
        },
      },
    },
    y: {
      beginAtZero: true,
      max: 100,
      grid: {
        color: theme.colors.divider,
        drawBorder: false,
      },
      ticks: {
        color: theme.colors.textSecondary,
        font: {
          size: 11,
        },
        callback: (value: number) => `${value}%`,
      },
    },
  },
});

/**
 * CustomerHealthChart component that visualizes customer health scores with real-time updates
 * Implements WCAG 2.1 Level AA compliance and Blitzy Enterprise Design System
 */
const CustomerHealthChart: React.FC<CustomerHealthChartProps> = React.memo(({
  customerId,
  timeRange = 30,
  height = 300,
  className,
  refreshInterval = 5000,
}) => {
  const { theme } = useTheme();
  const chartRef = React.useRef<Chart | null>(null);
  const [healthData, setHealthData] = React.useState<number[]>([]);
  const [labels, setLabels] = React.useState<string[]>([]);

  // Fetch initial health score data
  const { data: initialData, isLoading, error } = useQuery(
    ['customerHealth', customerId, timeRange],
    () => getCustomerHealthScore(customerId, { historical: true }),
    {
      refetchInterval: refreshInterval,
      staleTime: refreshInterval / 2,
    }
  );

  // WebSocket connection for real-time updates
  const { lastMessage } = useWebSocket(
    `${process.env.VITE_WS_URL}/customer-health/${customerId}`,
    {
      shouldReconnect: () => true,
      reconnectInterval: 3000,
      reconnectAttempts: 5,
    }
  );

  // Update chart data when new health score received
  React.useEffect(() => {
    if (lastMessage) {
      try {
        const update = JSON.parse(lastMessage.data);
        setHealthData(prevData => {
          const newData = [...prevData, update.score];
          return newData.slice(-timeRange);
        });
      } catch (error) {
        console.error('Failed to parse health score update:', error);
      }
    }
  }, [lastMessage, timeRange]);

  // Initialize and update chart
  React.useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.ctx;
    const config = getChartConfig(theme);
    const data = formatHealthData(healthData, labels);

    chartRef.current.data = data;
    chartRef.current.options = config;
    chartRef.current.update();
  }, [healthData, labels, theme]);

  // Clean up chart instance on unmount
  React.useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  return (
    <ChartContainer
      title="Customer Health Trend"
      loading={isLoading}
      error={error?.message}
      height={height}
      className={className}
    >
      <canvas
        ref={(element) => {
          if (element) {
            chartRef.current = new Chart(element, {
              type: 'line',
              data: formatHealthData(healthData, labels),
              options: getChartConfig(theme),
            });
          }
        }}
        role="img"
        aria-label="Customer health score trend chart"
      />
    </ChartContainer>
  );
});

CustomerHealthChart.displayName = 'CustomerHealthChart';

export default CustomerHealthChart;