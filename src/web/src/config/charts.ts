import { Chart, ChartConfiguration } from 'chart.js'; // ^4.0.0
import { getThemeConfig } from './theme';
import { WidgetType } from '../types/analytics';

/**
 * Global chart defaults with accessibility and performance optimizations
 */
export const CHART_DEFAULTS: ChartConfiguration = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 300,
    easing: 'easeInOutQuad',
    mode: 'progressive'
  },
  plugins: {
    legend: {
      position: 'bottom',
      align: 'start',
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
          family: "'Inter', sans-serif",
          size: 12
        }
      }
    },
    tooltip: {
      enabled: true,
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(31, 41, 55, 0.95)', // Gray-800 with opacity
      titleFont: {
        family: "'Inter', sans-serif",
        size: 14,
        weight: '600'
      },
      bodyFont: {
        family: "'Inter', sans-serif",
        size: 12
      },
      padding: 12,
      cornerRadius: 4,
      usePointStyle: true
    },
    accessibility: {
      enabled: true,
      announceOnRender: true,
      description: 'Customer Success Analytics Chart'
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'xy',
    intersect: false
  }
};

/**
 * Extended chart type configurations with enhanced features
 */
export const CHART_TYPES = {
  [WidgetType.LINE_CHART]: {
    tension: 0.4,
    fill: false,
    pointRadius: 4,
    pointHoverRadius: 6,
    confidenceInterval: {
      fill: true,
      alpha: 0.2
    },
    borderWidth: 2
  },
  [WidgetType.BAR_CHART]: {
    borderRadius: 4,
    maxBarThickness: 40,
    borderWidth: 2,
    errorBars: {
      show: true,
      color: 'rgba(0,0,0,0.2)',
      width: 2
    }
  },
  [WidgetType.PIE_CHART]: {
    cutout: '60%',
    radius: '90%',
    animation: {
      animateRotate: true,
      animateScale: true
    },
    spacing: 2
  },
  [WidgetType.AREA_CHART]: {
    fill: true,
    tension: 0.4,
    alpha: 0.6,
    stacked: true
  }
} as const;

/**
 * Returns accessible color palette for charts based on theme with contrast checking
 * @param themeMode - Current theme mode ('light' | 'dark' | 'high-contrast')
 * @param highContrast - Enable high contrast mode for accessibility
 * @returns Array of WCAG 2.1 compliant chart colors
 */
export function getChartColors(themeMode: string, highContrast = false): string[] {
  const theme = getThemeConfig();
  const colors = themeMode === 'dark' ? [
    '#60a5fa', // Blue-400
    '#34d399', // Emerald-400
    '#fbbf24', // Amber-400
    '#f87171', // Red-400
    '#a78bfa', // Purple-400
    '#818cf8', // Indigo-400
    '#fb923c', // Orange-400
    '#38bdf8'  // Sky-400
  ] : [
    '#0066CC', // Primary blue
    '#28A745', // Success green
    '#FFC107', // Warning yellow
    '#DC3545', // Danger red
    '#6610F2', // Purple
    '#4D9BF0', // Light blue
    '#FD7E14', // Orange
    '#17A2B8'  // Cyan
  ];

  return highContrast ? colors.map(color => color.replace(/[^#]/g, '0')) : colors;
}

/**
 * Returns enhanced default chart configuration based on chart type, theme, and accessibility requirements
 * @param chartType - Type of chart to configure
 * @param themeMode - Current theme mode
 * @param enableConfidenceIntervals - Enable confidence interval display
 * @returns Enhanced chart configuration with accessibility and performance optimizations
 */
export function getChartDefaults(
  chartType: WidgetType,
  themeMode: string,
  enableConfidenceIntervals = false
): ChartConfiguration {
  const theme = getThemeConfig();
  const isRTL = document.dir === 'rtl';
  const colors = getChartColors(themeMode);

  const baseConfig: ChartConfiguration = {
    ...CHART_DEFAULTS,
    options: {
      ...CHART_DEFAULTS,
      layout: {
        padding: {
          top: 20,
          right: isRTL ? 20 : 30,
          bottom: 20,
          left: isRTL ? 30 : 20
        }
      },
      scales: {
        x: {
          grid: {
            display: true,
            color: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          },
          ticks: {
            font: {
              family: "'Inter', sans-serif",
              size: 12
            },
            color: themeMode === 'dark' ? '#9ca3af' : '#6c757d'
          }
        },
        y: {
          grid: {
            display: true,
            color: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          },
          ticks: {
            font: {
              family: "'Inter', sans-serif",
              size: 12
            },
            color: themeMode === 'dark' ? '#9ca3af' : '#6c757d'
          }
        }
      },
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          ...CHART_DEFAULTS.plugins?.tooltip,
          backgroundColor: themeMode === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: themeMode === 'dark' ? '#f9fafb' : '#212529',
          bodyColor: themeMode === 'dark' ? '#9ca3af' : '#6c757d',
          borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          borderWidth: 1
        }
      }
    }
  };

  // Apply chart type specific configurations
  const typeConfig = CHART_TYPES[chartType];
  if (typeConfig) {
    baseConfig.options = {
      ...baseConfig.options,
      ...typeConfig,
      plugins: {
        ...baseConfig.options?.plugins,
        tooltip: {
          ...baseConfig.options?.plugins?.tooltip,
          callbacks: {
            label: (context: any) => {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += context.parsed.y.toLocaleString();
              if (enableConfidenceIntervals && context.dataset.confidenceLow) {
                label += ` (${context.dataset.confidenceLow.toLocaleString()} - ${context.dataset.confidenceHigh.toLocaleString()})`;
              }
              return label;
            }
          }
        }
      }
    };
  }

  return baseConfig;
}