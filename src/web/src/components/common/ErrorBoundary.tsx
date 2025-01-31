import React from 'react'; // ^18.0.0
import Card from './Card';
import Toast from './Toast';

/**
 * Props interface for ErrorBoundary component with enhanced configuration options
 */
interface ErrorBoundaryProps {
  /** Child components to be rendered */
  children: React.ReactNode;
  /** Optional custom fallback UI component */
  fallback?: React.ReactNode;
  /** Optional error callback function */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Enable automatic retry functionality */
  enableRetry?: boolean;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Show toast notification on error */
  showToast?: boolean;
  /** Custom error title */
  errorTitle?: string;
  /** Custom retry button text */
  retryButtonText?: string;
}

/**
 * Enhanced state interface for ErrorBoundary with detailed error tracking
 */
interface ErrorBoundaryState {
  /** Current error object */
  error: Error | null;
  /** React error info object */
  errorInfo: React.ErrorInfo | null;
  /** Total error count */
  errorCount: number;
  /** Current retry attempt count */
  retryCount: number;
  /** Error occurrence timestamp */
  timestamp: Date;
  /** Unique error identifier */
  errorId: string;
  /** Recovery state flag */
  isRecovering: boolean;
}

/**
 * Enhanced React error boundary component with comprehensive error handling,
 * monitoring, and recovery features. Implements Blitzy Enterprise Design System.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      errorCount: 0,
      retryCount: 0,
      timestamp: new Date(),
      errorId: this.generateErrorId(),
      isRecovering: false
    };
  }

  /**
   * Generates a unique error identifier
   */
  private generateErrorId = (): string => {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Static lifecycle method for capturing errors and updating state
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      error,
      timestamp: new Date(),
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isRecovering: false
    };
  }

  /**
   * Enhanced error handling lifecycle method with monitoring and notifications
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const { onError, showToast } = this.props;

    // Update error state
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
      timestamp: new Date()
    }));

    // Call error callback if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', {
        error,
        errorInfo,
        errorId: this.state.errorId,
        timestamp: this.state.timestamp
      });
    }

    // Show toast notification if enabled
    if (showToast) {
      this.showErrorToast(error);
    }
  }

  /**
   * Displays error toast notification using Blitzy Toast component
   */
  private showErrorToast = (error: Error): void => {
    const { errorTitle = 'An error occurred' } = this.props;
    
    Toast({
      id: this.state.errorId,
      title: errorTitle,
      message: error.message,
      type: 'error',
      duration: 5000,
      position: 'top-right',
      onDismiss: () => {},
      ariaLive: 'assertive'
    });
  };

  /**
   * Handles error recovery attempts
   */
  private handleRetry = (): void => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        isRecovering: true
      }));
    }
  };

  /**
   * Renders error UI or children with enhanced error display
   */
  render(): React.ReactNode {
    const { children, fallback, enableRetry, retryButtonText = 'Retry' } = this.props;
    const { error, errorInfo, retryCount, errorId } = this.state;

    if (error) {
      // Return custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Return themed error Card component
      return (
        <Card
          variant="elevated"
          className="error-boundary-card"
          highContrast={true}
          aria-live="polite"
        >
          <div className="error-boundary-content">
            <h3 className="error-title">
              Something went wrong
            </h3>
            <p className="error-message">
              {error.message}
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre className="error-stack">
                {errorInfo?.componentStack}
              </pre>
            )}
            {enableRetry && retryCount < (this.props.maxRetries || 3) && (
              <button
                onClick={this.handleRetry}
                className="retry-button"
                aria-label={retryButtonText}
              >
                {retryButtonText}
              </button>
            )}
            <div className="error-metadata">
              <span>Error ID: {errorId}</span>
              {retryCount > 0 && (
                <span>Retry attempt: {retryCount}</span>
              )}
            </div>
          </div>
        </Card>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
export type { ErrorBoundaryProps, ErrorBoundaryState };