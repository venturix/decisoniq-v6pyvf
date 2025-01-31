# Base stage with common setup
FROM node:18-alpine AS base
LABEL maintainer="Customer Success AI Platform Team" \
      version="1.0.0"

# Create non-root user for security
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Set working directory and environment
WORKDIR /app
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=4096"

# Copy package files with appropriate permissions
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup tsconfig.json ./

# Install production dependencies
RUN npm ci --only=production && \
    # Security hardening
    npm audit fix && \
    # Clean npm cache
    npm cache clean --force

# Development stage
FROM base AS development
ENV NODE_ENV=development \
    PORT=3000

# Install dev dependencies
RUN npm install

# Configure for development
USER appuser
EXPOSE 3000

# Development command
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build

# Copy source code
COPY --chown=appuser:appgroup . .

# Build application
RUN npm ci && \
    npm run type-check && \
    npm run lint && \
    npm run build && \
    # Remove source maps in production
    rm -rf dist/**/*.map

# Production stage
FROM nginx:1.25-alpine AS production
LABEL environment="production"

# Install security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache curl && \
    # Create nginx user if it doesn't exist
    adduser -D -H -u 101 -s /sbin/nologin nginx

# Copy nginx configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx:nginx nginx.security.conf /etc/nginx/conf.d/security.conf

# Copy built assets from build stage
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Security hardening
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    # Make nginx run with read-only root filesystem
    chmod -R 555 /usr/share/nginx/html && \
    # Remove default nginx config
    rm -rf /etc/nginx/conf.d/default.conf

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Expose ports
EXPOSE 80 443

# Switch to non-root user
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Build arguments
ARG VITE_APP_NAME
ARG VITE_API_BASE_URL
ARG VITE_API_VERSION
ARG VITE_BLITZY_ENVIRONMENT
ARG NGINX_WORKER_PROCESSES=auto
ARG NGINX_WORKER_CONNECTIONS=1024

# Development volumes
VOLUME ["/app/node_modules", "/app/src", "/app/.env"]