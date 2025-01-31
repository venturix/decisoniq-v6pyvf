import React from 'react'; // ^18.0.0
import { BlitzyPageBuilder } from '@blitzy/page-builder'; // ^2.0.0
import { 
  type BlitzyPageBuilderConfig, 
  type BlitzyBreakpoints,
  type BlitzyLayoutPatterns,
  isValidBreakpoint 
} from '../../types/blitzy';
import { useTheme } from './theme';

// Grid system configuration with fluid breakpoints
const DEFAULT_GRID_CONFIG = {
  columns: 12,
  rows: 'auto',
  gap: '1rem',
  breakpoints: {
    mobile: { columns: 4 },
    tablet: { columns: 8 },
    desktop: { columns: 12 }
  }
} as const;

// Responsive breakpoints with margin configurations
const BREAKPOINTS: Record<keyof BlitzyBreakpoints, { width: number; columns: number; margin: string }> = {
  mobile: { width: 320, columns: 4, margin: '1rem' },
  tablet: { width: 768, columns: 8, margin: '2rem' },
  desktop: { width: 1024, columns: 12, margin: '3rem' },
  large: { width: 1440, columns: 12, margin: '4rem' }
};

// Layout patterns with accessibility configurations
const LAYOUT_PATTERNS: Record<BlitzyLayoutPatterns, { 
  type: string;
  gridAreas: string[];
  accessibility: { landmarks: boolean };
}> = {
  'z-pattern': {
    type: 'z-pattern',
    gridAreas: ['header', 'main', 'sidebar'],
    accessibility: { landmarks: true }
  },
  'f-pattern': {
    type: 'f-pattern',
    gridAreas: ['header', 'content', 'footer'],
    accessibility: { landmarks: true }
  }
};

/**
 * Enhanced page builder class with layout pattern support and accessibility features
 */
export class PageBuilder {
  private config: BlitzyPageBuilderConfig;
  private components: Map<string, React.ComponentType>;
  private blitzyBuilder: typeof BlitzyPageBuilder;
  private errorBoundary: React.ComponentType;

  constructor(config: BlitzyPageBuilderConfig) {
    this.validateConfig(config);
    this.config = this.enhanceConfig(config);
    this.components = new Map();
    this.blitzyBuilder = BlitzyPageBuilder;
    this.errorBoundary = this.createErrorBoundary();
    this.initializeComponents();
  }

  /**
   * Validates the provided configuration
   */
  private validateConfig(config: BlitzyPageBuilderConfig): void {
    if (!config.theme || !config.components || !config.layouts) {
      throw new Error('Invalid page builder configuration: missing required properties');
    }
  }

  /**
   * Enhances configuration with default values and accessibility features
   */
  private enhanceConfig(config: BlitzyPageBuilderConfig): BlitzyPageBuilderConfig {
    return {
      ...config,
      layouts: {
        ...config.layouts,
        grid: DEFAULT_GRID_CONFIG
      },
      accessibility: {
        landmarks: true,
        ariaLabels: true,
        keyboardNav: true
      }
    };
  }

  /**
   * Initializes component registry with performance optimization
   */
  private initializeComponents(): void {
    Object.entries(this.config.components).forEach(([name, component]) => {
      this.components.set(name, React.memo(component));
    });
  }

  /**
   * Creates error boundary component for graceful failure handling
   */
  private createErrorBoundary(): React.ComponentType {
    return class ErrorBoundary extends React.Component<
      { children: React.ReactNode },
      { hasError: boolean }
    > {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
      }

      static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true };
      }

      componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('Page Builder Error:', error, info);
      }

      render(): React.ReactNode {
        if (this.state.hasError) {
          return (
            <div role="alert" className="page-builder-error">
              Something went wrong. Please try refreshing the page.
            </div>
          );
        }
        return this.props.children;
      }
    };
  }

  /**
   * Builds responsive grid styles based on breakpoints
   */
  private buildGridStyles(): Record<string, string> {
    const styles: Record<string, string> = {};
    
    Object.entries(BREAKPOINTS).forEach(([breakpoint, config]) => {
      if (isValidBreakpoint(breakpoint)) {
        styles[`@media (min-width: ${config.width}px)`] = `
          grid-template-columns: repeat(${config.columns}, 1fr);
          margin: 0 ${config.margin};
        `;
      }
    });

    return styles;
  }

  /**
   * Builds page component with layout patterns and accessibility
   */
  public build(): React.ComponentType {
    const { theme } = useTheme();
    const gridStyles = this.buildGridStyles();

    const PageComponent: React.FC = () => {
      const layoutPattern = LAYOUT_PATTERNS[this.config.layouts.pattern as BlitzyLayoutPatterns];
      
      return (
        <this.errorBoundary>
          <this.blitzyBuilder
            theme={theme}
            components={this.components}
            layout={{
              ...layoutPattern,
              grid: {
                ...DEFAULT_GRID_CONFIG,
                styles: gridStyles
              }
            }}
            accessibility={{
              landmarks: true,
              ariaLabels: true,
              keyboardNav: true
            }}
          />
        </this.errorBoundary>
      );
    };

    return React.memo(PageComponent);
  }
}

/**
 * Creates a new page component with enhanced layout patterns and accessibility support
 */
export const createPage = (config: BlitzyPageBuilderConfig): React.ComponentType => {
  const builder = new PageBuilder(config);
  return builder.build();
};