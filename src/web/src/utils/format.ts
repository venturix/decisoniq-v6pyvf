import { IntlShape } from '@formatjs/intl'; // v2.9.0
import { MetricType } from '../types/metrics';
import { CustomerRiskLevel } from '../types/customer';
import { formatDate } from './date';

/**
 * Interface for enhanced format function options
 */
interface FormatOptions {
  locale?: string;
  decimals?: number;
  currency?: string;
  showTrend?: boolean;
  unitDisplay?: 'narrow' | 'short' | 'long';
  accessibility?: {
    role?: string;
    label?: string;
  };
}

// Cache for memoizing frequently used format results
const formatCache = new Map<string, string>();
const CACHE_MAX_SIZE = 1000;

/**
 * Formats a number as currency with proper locale, symbol, and precision
 * @param value - Numeric value to format
 * @param currency - Currency code (e.g., 'USD')
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency: string = 'USD', options: FormatOptions = {}): string {
  try {
    if (value == null || isNaN(value)) return '';

    const cacheKey = `currency-${value}-${currency}-${JSON.stringify(options)}`;
    if (formatCache.has(cacheKey)) {
      return formatCache.get(cacheKey)!;
    }

    const formatter = new Intl.NumberFormat(options.locale || 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: options.decimals ?? 2,
      maximumFractionDigits: options.decimals ?? 2
    });

    const formatted = formatter.format(value);
    
    if (formatCache.size < CACHE_MAX_SIZE) {
      formatCache.set(cacheKey, formatted);
    }

    return formatted;
  } catch (error) {
    console.error('Currency formatting error:', error);
    return `${value} ${currency}`;
  }
}

/**
 * Formats a decimal number as a percentage with precision control
 * @param value - Decimal value to format (0.95 = 95%)
 * @param decimals - Number of decimal places
 * @param options - Formatting options
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 1, options: FormatOptions = {}): string {
  try {
    if (value == null || isNaN(value)) return '';

    const cacheKey = `percentage-${value}-${decimals}-${JSON.stringify(options)}`;
    if (formatCache.has(cacheKey)) {
      return formatCache.get(cacheKey)!;
    }

    const formatter = new Intl.NumberFormat(options.locale || 'en-US', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    const formatted = formatter.format(value);
    
    if (formatCache.size < CACHE_MAX_SIZE) {
      formatCache.set(cacheKey, formatted);
    }

    return formatted;
  } catch (error) {
    console.error('Percentage formatting error:', error);
    return `${(value * 100).toFixed(decimals)}%`;
  }
}

/**
 * Formats a metric value based on its type with enhanced features
 * @param value - Numeric value to format
 * @param type - Type of metric
 * @param options - Formatting options
 * @returns Formatted metric string
 */
export function formatMetric(value: number, type: MetricType, options: FormatOptions = {}): string {
  try {
    if (value == null || isNaN(value)) return '';

    const cacheKey = `metric-${value}-${type}-${JSON.stringify(options)}`;
    if (formatCache.has(cacheKey)) {
      return formatCache.get(cacheKey)!;
    }

    let formatted: string;
    switch (type) {
      case MetricType.CHURN_RATE:
      case MetricType.RETENTION_RATE:
      case MetricType.OPERATIONAL_EFFICIENCY:
        formatted = formatPercentage(value, options.decimals ?? 1, options);
        break;
      
      case MetricType.REVENUE_IMPACT:
        formatted = formatCurrency(value, options.currency ?? 'USD', {
          ...options,
          decimals: options.decimals ?? 0
        });
        break;
      
      default:
        formatted = new Intl.NumberFormat(options.locale || 'en-US', {
          minimumFractionDigits: options.decimals ?? 0,
          maximumFractionDigits: options.decimals ?? 0,
          style: 'decimal'
        }).format(value);
    }

    if (options.showTrend && value !== 0) {
      const trend = value > 0 ? '↑' : '↓';
      formatted = `${formatted} ${trend}`;
    }

    if (formatCache.size < CACHE_MAX_SIZE) {
      formatCache.set(cacheKey, formatted);
    }

    return formatted;
  } catch (error) {
    console.error('Metric formatting error:', error);
    return value.toString();
  }
}

/**
 * Formats a risk level enum to display text with accessibility
 * @param level - Risk level enum value
 * @param options - Formatting options
 * @returns Formatted risk level string
 */
export function formatRiskLevel(level: CustomerRiskLevel, options: FormatOptions = {}): string {
  try {
    if (!level) return '';

    const cacheKey = `risk-${level}-${JSON.stringify(options)}`;
    if (formatCache.has(cacheKey)) {
      return formatCache.get(cacheKey)!;
    }

    const riskDisplayMap: Record<CustomerRiskLevel, string> = {
      [CustomerRiskLevel.LOW]: 'Low Risk',
      [CustomerRiskLevel.MEDIUM]: 'Medium Risk',
      [CustomerRiskLevel.HIGH]: 'High Risk',
      [CustomerRiskLevel.CRITICAL]: 'Critical Risk'
    };

    const formatted = riskDisplayMap[level] || level;
    
    if (formatCache.size < CACHE_MAX_SIZE) {
      formatCache.set(cacheKey, formatted);
    }

    return formatted;
  } catch (error) {
    console.error('Risk level formatting error:', error);
    return level;
  }
}

/**
 * Clears the format cache
 * @internal
 */
export function clearFormatCache(): void {
  formatCache.clear();
}