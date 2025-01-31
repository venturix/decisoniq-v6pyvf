/// <reference types="vite/client" />

/**
 * Type declarations for Vite environment variables used in the Customer Success AI Platform
 * @version Vite 4.4.0
 */
interface ImportMetaEnv {
  /**
   * Base URL for the backend API endpoints
   */
  readonly VITE_API_URL: string;

  /**
   * API key for Blitzy platform integration
   */
  readonly VITE_BLITZY_API_KEY: string;

  /**
   * Auth0 domain for SSO authentication
   */
  readonly VITE_AUTH0_DOMAIN: string;

  /**
   * Auth0 client ID for application authentication
   */
  readonly VITE_AUTH0_CLIENT_ID: string;

  /**
   * AWS SageMaker endpoint for ML model predictions
   */
  readonly VITE_SAGEMAKER_ENDPOINT: string;

  /**
   * Current deployment environment (development/staging/production)
   */
  readonly VITE_ENVIRONMENT: string;
}

/**
 * Type augmentation for Vite's import.meta.env
 * Provides TypeScript type safety for environment variables
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Type declarations for static asset imports
 */
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.avif' {
  const content: string;
  export default content;
}

declare module '*.ico' {
  const content: string;
  export default content;
}

declare module '*.bmp' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const content: { [key: string]: any };
  export default content;
}

declare module '*.css' {
  const content: { [key: string]: string };
  export default content;
}

declare module '*.scss' {
  const content: { [key: string]: string };
  export default content;
}

declare module '*.sass' {
  const content: { [key: string]: string };
  export default content;
}

declare module '*.less' {
  const content: { [key: string]: string };
  export default content;
}

declare module '*.styl' {
  const content: { [key: string]: string };
  export default content;
}