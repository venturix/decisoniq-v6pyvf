import { type BlitzyThemeConfig } from '../../types/blitzy';

/**
 * Dark theme configuration for the Customer Success AI Platform
 * Implements WCAG 2.1 Level AA compliant color schemes with a minimum contrast ratio of 4.5:1
 * Provides semantic color mapping for consistent UI patterns
 * Includes specialized palettes for data visualization and risk indicators
 */
const darkTheme: BlitzyThemeConfig = {
  mode: 'dark',
  colors: {
    // Primary brand colors
    primary: '#3b82f6', // Blue-500 - Primary actions and focus states
    secondary: '#6366f1', // Indigo-500 - Secondary actions and accents
    
    // Background hierarchy
    background: '#111827', // Gray-900 - Main application background
    surface: '#1f2937', // Gray-800 - Component surfaces
    surfaceHover: '#374151', // Gray-700 - Hover states
    surfaceActive: '#4b5563', // Gray-600 - Active states
    
    // Typography
    text: '#f9fafb', // Gray-50 - Primary text
    textSecondary: '#9ca3af', // Gray-400 - Secondary text
    textDisabled: '#6b7280', // Gray-500 - Disabled text
    
    // Borders and focus states
    border: '#374151', // Gray-700 - Default borders
    borderFocus: '#60a5fa', // Blue-400 - Focus indicators
    
    // Status indicators
    error: '#ef4444', // Red-500
    errorLight: '#fee2e2', // Red-100
    warning: '#f59e0b', // Amber-500
    warningLight: '#fef3c7', // Amber-100
    success: '#10b981', // Emerald-500
    successLight: '#d1fae5', // Emerald-100
    info: '#60a5fa', // Blue-400
    infoLight: '#dbeafe', // Blue-100
    
    // Risk assessment colors
    riskHigh: '#dc2626', // Red-600
    riskHighBg: '#fee2e2', // Red-100
    riskMedium: '#d97706', // Amber-600
    riskMediumBg: '#fef3c7', // Amber-100
    riskLow: '#059669', // Emerald-600
    riskLowBg: '#d1fae5', // Emerald-100
    
    // Data visualization
    chart: {
      background: '#1f2937', // Gray-800
      grid: '#374151', // Gray-700
      tooltip: '#374151', // Gray-700
      tooltipText: '#f9fafb', // Gray-50
      series: [
        '#60a5fa', // Blue-400
        '#34d399', // Emerald-400
        '#fbbf24', // Amber-400
        '#f87171', // Red-400
        '#a78bfa', // Purple-400
        '#818cf8', // Indigo-400
        '#fb923c', // Orange-400
        '#38bdf8', // Sky-400
      ],
    },
    
    // Dashboard-specific colors
    dashboard: {
      cardBg: '#1f2937', // Gray-800
      cardBorder: '#374151', // Gray-700
      cardHover: '#374151', // Gray-700
      widgetBg: '#111827', // Gray-900
      widgetBorder: '#1f2937', // Gray-800
    },
    
    // Navigation colors
    navigation: {
      bg: '#111827', // Gray-900
      itemHover: '#1f2937', // Gray-800
      itemActive: '#2563eb', // Blue-600
      itemText: '#f9fafb', // Gray-50
      itemTextHover: '#ffffff', // White
    },
  },
};

export default darkTheme;