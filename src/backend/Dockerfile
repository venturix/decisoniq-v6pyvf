# Stage 1: Builder
FROM python:3.11-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    build-base \
    postgresql-dev

# Set working directory
WORKDIR /build

# Copy requirements file with hash verification
COPY requirements.txt .
RUN sha256sum requirements.txt > requirements.txt.hash

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt && \
    pip freeze > installed.txt && \
    diff -u requirements.txt installed.txt || true

# Stage 2: Final runtime
FROM python:3.11-alpine

# Set environment variables
ENV APP_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=8000 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-libs \
    curl

# Create non-root user
RUN addgroup -g 1000 appuser && \
    adduser -u 1000 -G appuser -s /bin/sh -D appuser

# Set working directory
WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/

# Copy application code
COPY --chown=appuser:appuser . .

# Create and set permissions for data directory
RUN mkdir -p /app/data && \
    chown -R appuser:appuser /app/data

# Switch to non-root user
USER appuser

# Expose API port
EXPOSE 8000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:8000/api/health || exit 1

# Container metadata
LABEL org.opencontainers.image.source="https://github.com/org/customer-success-ai" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      com.customer-success-ai.environment="production" \
      com.customer-success-ai.component="backend-api"

# Security options
RUN chmod -R 555 /app && \
    chmod -R 777 /app/data

# Set entrypoint with production configuration
ENTRYPOINT ["uvicorn", "src.api.server:app", \
    "--host", "0.0.0.0", \
    "--port", "8000", \
    "--workers", "4", \
    "--limit-concurrency", "1000", \
    "--timeout-keep-alive", "30"]