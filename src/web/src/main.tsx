import React, { StrictMode } from 'react'; // ^18.2.0
import ReactDOM from 'react-dom/client'; // ^18.2.0
import { Provider } from 'react-redux'; // ^8.0.5
import {
  BlitzyErrorBoundary,
  BlitzyThemeProvider,
  BlitzyPerformanceMonitor
} from '@blitzy/premium-ui'; // ^2.0.0
import App from './App';

// Constants for configuration
const ROOT_ELEMENT_ID = 'root';
const PERFORMANCE_TARGET = 3000; // 3 seconds target from technical spec
const ERROR_REPORTING_CONFIG = {
  endpoint: process.env.VITE_ERROR_ENDPOINT,
  appVersion: process.env.VITE_APP_VERSION,
  sampleRate: 1.0
};

/**
 * Initialize and render the React application with all required providers
 * Implements enterprise-grade error boundaries and performance monitoring
 */
const renderApp = () => {
  // Get root element with strict null check
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);
  if (!rootElement) {
    throw new Error(`Root element with ID "${ROOT_ELEMENT_ID}" not found`);
  }

  // Create React root with concurrent features
  const root = ReactDOM.createRoot(rootElement);

  // Render application with all required providers
  root.render(
    <StrictMode>
      <BlitzyErrorBoundary
        config={ERROR_REPORTING_CONFIG}
        fallback={({ error, resetErrorBoundary }) => (
          <div role="alert" className="error-boundary">
            <h2>Application Error</h2>
            <pre>{error.message}</pre>
            <button onClick={resetErrorBoundary}>Retry</button>
          </div>
        )}
      >
        <BlitzyPerformanceMonitor
          target={PERFORMANCE_TARGET}
          metrics={['FCP', 'LCP', 'CLS', 'FID']}
        >
          <BlitzyThemeProvider
            defaultMode="light"
            enableHighContrast={true}
            enableReducedMotion={true}
          >
            <Provider store={store}>
              <App />
            </Provider>
          </BlitzyThemeProvider>
        </BlitzyPerformanceMonitor>
      </BlitzyErrorBoundary>
    </StrictMode>
  );
};

/**
 * Handle proper cleanup of application resources
 */
const cleanupApp = () => {
  // Cleanup performance monitoring
  BlitzyPerformanceMonitor.cleanup();

  // Clear error boundary cache
  BlitzyErrorBoundary.clearCache();

  // Remove event listeners
  window.removeEventListener('unload', cleanupApp);
};

// Initialize application
try {
  // Add cleanup handler
  window.addEventListener('unload', cleanupApp);

  // Render application
  renderApp();
} catch (error) {
  // Log fatal errors
  console.error('Fatal application error:', error);

  // Report to error tracking
  BlitzyErrorBoundary.reportError(error);

  // Display fallback UI
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);
  if (rootElement) {
    rootElement.innerHTML = `
      <div role="alert" style="padding: 20px; text-align: center;">
        <h1>Unable to Load Application</h1>
        <p>Please try refreshing the page. If the problem persists, contact support.</p>
      </div>
    `;
  }
}