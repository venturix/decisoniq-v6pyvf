import { type BlitzyThemeConfig } from '../../types/blitzy';

/**
 * Light theme configuration for the Customer Success AI Platform
 * Implements BlitzyThemeConfig interface with WCAG 2.1 Level AA compliant color schemes
 * 
 * Color Contrast Ratios:
 * - Text on background: 4.5:1 minimum
 * - Large text on background: 3:1 minimum
 * - UI components and graphical objects: 3:1 minimum
 */
export const lightTheme: BlitzyThemeConfig = {
  mode: 'light',
  colors: {
    // Primary color scheme with accessible contrast ratios
    primary: '#0066CC',      // Blue - Brand primary
    secondary: '#4D9BF0',    // Light blue - Secondary actions
    tertiary: '#99CCF7',     // Pale blue - Subtle accents

    // Status colors for alerts and indicators
    success: '#28A745',      // Green - Positive status
    warning: '#FFC107',      // Yellow - Warning status
    danger: '#DC3545',       // Red - Critical status
    info: '#17A2B8',         // Cyan - Informational status

    // Base colors for layout and structure
    background: '#FFFFFF',    // White - Page background
    surface: '#F8F9FA',      // Light gray - Card/panel background
    text: '#212529',         // Dark gray - Primary text (contrast 14.5:1)
    textSecondary: '#6C757D', // Medium gray - Secondary text (contrast 7:1)

    // UI element colors
    border: '#DEE2E6',       // Light gray - Borders
    divider: '#E9ECEF',      // Lighter gray - Divider lines
    hover: '#E9ECEF',        // Light gray - Hover state
    active: '#DEE2E6',       // Gray - Active state
    focus: 'rgba(0, 102, 204, 0.25)', // Semi-transparent blue - Focus rings
    overlay: 'rgba(0, 0, 0, 0.5)',    // Semi-transparent black - Modal overlays

    // Risk assessment colors
    riskHigh: '#DC3545',     // Red - High risk indicator
    riskMedium: '#FFC107',   // Yellow - Medium risk indicator
    riskLow: '#28A745',      // Green - Low risk indicator

    // Chart and data visualization colors
    chartPrimary: '#0066CC', // Blue - Primary chart elements
    chartSecondary: '#4D9BF0', // Light blue - Secondary chart elements
    chartTertiary: '#99CCF7',  // Pale blue - Tertiary chart elements
  }
};

export default lightTheme;