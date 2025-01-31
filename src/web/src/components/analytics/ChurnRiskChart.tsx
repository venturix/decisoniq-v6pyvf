import React, { useEffect, useMemo } from 'react';
import ReactApexCharts from 'react-apexcharts'; // ^3.41.0
import { ChartContainer } from './ChartContainer';
import { useRisk } from '../../hooks/useRisk';
import { selectRiskScore } from '../../store/risk/selectors';
import { useTheme } from '../../lib/blitzy/theme';
import { RiskLevel } from '../../types/risk';
import { PERFORMANCE_THRESHOLDS } from '../../config/constants';

/**
 * Props interface for ChurnRiskChart component with enhanced type safety
 */
interface ChurnRiskChartProps {
  /** Unique identifier for customer risk data */
  customerId: string;
  /** Chart height in pixels with responsive scaling */
  height?: number;
  /** Additional CSS classes for styling customization */
  className?: string;
}

/**
 * A React component that visualizes customer churn risk data using interactive charts
 * Implements real-time updates, accessibility features, and responsive design
 * Follows Blitzy Enterprise Design System and WCAG 2.1 Level AA compliance
 */
const ChurnRiskChart: React.FC<ChurnRiskChartProps> = React.memo(({
  customerId,
  height = 300,
  className
}) => {
  const { theme } = useTheme();
  const { assessment, loading, error, refresh } = useRisk(customerId, {
    autoRefresh: true,
    refreshInterval: PERFORMANCE_THRESHOLDS.CACHE_TTL,
    enableWebSocket: true
  });

  // Memoized chart options with theme-aware styling
  const chartOptions = useMemo(() => ({
    chart: {
      type: 'radialBar',
      animations: {
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        }
      },
      background: theme.mode === 'dark' ? theme.colors.surface : 'transparent',
      fontFamily: 'inherit'
    },
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle: 135,
        hollow: {
          margin: 0,
          size: '70%',
          background: theme.mode === 'dark' ? theme.colors.background : '#fff',
          position: 'front'
        },
        track: {
          background: theme.mode === 'dark' ? theme.colors.border : '#f2f2f2',
          strokeWidth: '100%',
          margin: 5
        },
        dataLabels: {
          show: true,
          name: {
            show: true,
            fontSize: '16px',
            fontWeight: 600,
            color: theme.colors.text,
            offsetY: -10
          },
          value: {
            show: true,
            fontSize: '24px',
            fontWeight: 700,
            color: theme.colors.text,
            offsetY: 5,
            formatter: (val: number) => `${val}%`
          }
        }
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'horizontal',
        shadeIntensity: 0.5,
        gradientToColors: [getRiskColor(assessment?.score || 0)],
        inverseColors: true,
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 100]
      }
    },
    stroke: {
      lineCap: 'round'
    },
    labels: ['Risk Score'],
    colors: [getRiskColor(assessment?.score || 0)],
    tooltip: {
      enabled: true,
      theme: theme.mode,
      y: {
        formatter: (val: number) => `${val}% Risk Score`
      }
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            height: height * 0.8
          }
        }
      }
    ]
  }), [assessment?.score, height, theme]);

  // Memoized series data
  const series = useMemo(() => {
    return [assessment?.score || 0];
  }, [assessment?.score]);

  // Effect for handling real-time updates
  useEffect(() => {
    return () => {
      refresh();
    };
  }, [refresh]);

  /**
   * Gets risk color based on score threshold
   */
  function getRiskColor(score: number): string {
    if (score >= 90) return theme.colors.riskHigh;
    if (score >= 70) return theme.colors.warning;
    if (score >= 50) return theme.colors.info;
    return theme.colors.success;
  }

  return (
    <ChartContainer
      title="Churn Risk Assessment"
      loading={loading}
      error={error}
      height={height}
      className={className}
    >
      <ReactApexCharts
        options={chartOptions}
        series={series}
        type="radialBar"
        height={height}
        aria-label="Customer churn risk visualization"
        role="img"
      />
      {assessment && (
        <div 
          className="text-center mt-4"
          aria-live="polite"
        >
          <p className="text-sm font-medium">
            Risk Level: {RiskLevel[assessment.severityLevel]}
          </p>
          <p className="text-xs text-secondary">
            Last Updated: {new Date(assessment.updatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </ChartContainer>
  );
});

ChurnRiskChart.displayName = 'ChurnRiskChart';

export default ChurnRiskChart;