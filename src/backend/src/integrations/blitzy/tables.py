"""
Blitzy Tables Integration Module v1.0.0

Enterprise-grade integration with Blitzy Tables service providing high-performance
data storage and relationship management for the Customer Success AI Platform.

Dependencies:
- blitzy-tables-sdk==2.x
- asyncio==3.11+
- typing==3.11+

Features:
- High-performance data operations (100K events/day)
- Smart relationship management
- Connection pooling and retry logic
- Comprehensive security controls
- Performance monitoring and metrics
"""

import asyncio
from typing import Dict, List, Any, Optional, Union
from blitzy_tables import Client, ConnectionPool, TableSchema, SecurityConfig
from blitzy_tables.exceptions import BlitzyTablesError

from config.settings import db
from core.exceptions import IntegrationSyncError
from core.logging import get_logger

# Initialize structured logger
logger = get_logger(__name__)

# Performance and scaling constants
MAX_BATCH_SIZE = 1000  # Maximum records per batch operation
MAX_RETRIES = 3  # Maximum retry attempts for operations
CONNECTION_TIMEOUT = 30  # Connection timeout in seconds
QUERY_TIMEOUT = 10  # Query execution timeout in seconds
MAX_POOL_SIZE = 50  # Maximum connection pool size

class BlitzyTablesClient:
    """
    High-performance client for Blitzy Tables service with enterprise features
    including connection pooling, retry logic, and performance monitoring.
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        """
        Initialize Blitzy Tables client with enterprise configuration.

        Args:
            config: Configuration dictionary containing connection and security parameters
        """
        self._client: Optional[Client] = None
        self._config = self._validate_config(config)
        self._initialized = False
        self._connection_pool: Optional[ConnectionPool] = None
        self._metrics: Dict[str, Any] = {
            'operations': 0,
            'errors': 0,
            'latency_ms': [],
            'batch_sizes': []
        }

    def _validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and enhance configuration with security defaults."""
        required_fields = {'host', 'port', 'credentials'}
        if not all(field in config for field in required_fields):
            raise ValueError("Missing required configuration fields")

        # Enhance with secure defaults
        return {
            **config,
            'ssl_enabled': config.get('ssl_enabled', True),
            'connection_timeout': config.get('connection_timeout', CONNECTION_TIMEOUT),
            'query_timeout': config.get('query_timeout', QUERY_TIMEOUT),
            'max_pool_size': config.get('max_pool_size', MAX_POOL_SIZE),
            'retry_config': {
                'max_retries': config.get('max_retries', MAX_RETRIES),
                'backoff_factor': 2,
                'max_backoff': 30
            }
        }

    async def initialize(self) -> None:
        """Initialize secure connection to Blitzy Tables with connection pooling."""
        if self._initialized:
            return

        try:
            # Initialize connection pool
            self._connection_pool = ConnectionPool(
                max_size=self._config['max_pool_size'],
                ssl_context=db.configure_ssl_context() if self._config['ssl_enabled'] else None
            )

            # Create client with security configuration
            self._client = Client(
                host=self._config['host'],
                port=self._config['port'],
                credentials=self._config['credentials'],
                connection_pool=self._connection_pool,
                ssl_enabled=self._config['ssl_enabled'],
                timeout=self._config['connection_timeout']
            )

            # Verify connection and capabilities
            await self._client.ping()
            self._initialized = True

            logger.info(
                "Blitzy Tables client initialized successfully",
                extra={
                    'host': self._config['host'],
                    'pool_size': self._config['max_pool_size'],
                    'ssl_enabled': self._config['ssl_enabled']
                }
            )

        except Exception as e:
            logger.error(
                "Failed to initialize Blitzy Tables client",
                extra={'error': str(e), 'config': self._config}
            )
            raise IntegrationSyncError(
                message="Failed to initialize Blitzy Tables connection",
                sync_context={'error': str(e)}
            )

    async def create_table(
        self,
        table_name: str,
        schema: Dict[str, Any],
        security_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new table with specified schema and security settings.

        Args:
            table_name: Name of the table to create
            schema: Table schema definition
            security_config: Optional security configuration

        Returns:
            Dict containing created table details
        """
        await self._ensure_initialized()

        try:
            # Enhance schema with security controls
            enhanced_schema = TableSchema(
                **schema,
                security=SecurityConfig(**(security_config or {}))
            )

            # Create table with retry logic
            result = await self._execute_with_retry(
                lambda: self._client.create_table(
                    name=table_name,
                    schema=enhanced_schema
                )
            )

            logger.info(
                f"Created table: {table_name}",
                extra={'schema': schema, 'security': security_config}
            )
            return result

        except Exception as e:
            logger.error(
                f"Failed to create table: {table_name}",
                extra={'error': str(e), 'schema': schema}
            )
            raise IntegrationSyncError(
                message=f"Failed to create table: {str(e)}",
                sync_context={'table': table_name, 'schema': schema}
            )

    async def batch_insert(
        self,
        table_name: str,
        records: List[Dict[str, Any]],
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Insert multiple records with optimized batching and retry logic.

        Args:
            table_name: Target table name
            records: List of records to insert
            options: Optional insertion options

        Returns:
            Dict containing insertion results and metrics
        """
        await self._ensure_initialized()

        try:
            batches = [
                records[i:i + MAX_BATCH_SIZE]
                for i in range(0, len(records), MAX_BATCH_SIZE)
            ]

            results = []
            for batch in batches:
                batch_result = await self._execute_with_retry(
                    lambda: self._client.insert(
                        table=table_name,
                        records=batch,
                        options=options
                    )
                )
                results.append(batch_result)

                # Update metrics
                self._metrics['operations'] += 1
                self._metrics['batch_sizes'].append(len(batch))

            return {
                'success': True,
                'inserted_count': sum(len(batch) for batch in batches),
                'batch_count': len(batches),
                'results': results
            }

        except Exception as e:
            self._metrics['errors'] += 1
            logger.error(
                f"Batch insert failed for table: {table_name}",
                extra={'error': str(e), 'record_count': len(records)}
            )
            raise IntegrationSyncError(
                message=f"Batch insert failed: {str(e)}",
                sync_context={'table': table_name, 'record_count': len(records)}
            )

    async def query(
        self,
        table_name: str,
        query_params: Dict[str, Any],
        options: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute optimized queries with security controls and performance monitoring.

        Args:
            table_name: Table to query
            query_params: Query parameters and filters
            options: Optional query options

        Returns:
            List of query results
        """
        await self._ensure_initialized()

        try:
            start_time = asyncio.get_event_loop().time()

            result = await self._execute_with_retry(
                lambda: self._client.query(
                    table=table_name,
                    params=query_params,
                    options={
                        'timeout': self._config['query_timeout'],
                        **(options or {})
                    }
                )
            )

            # Update performance metrics
            query_time = (asyncio.get_event_loop().time() - start_time) * 1000
            self._metrics['latency_ms'].append(query_time)
            self._metrics['operations'] += 1

            logger.info(
                f"Query executed on table: {table_name}",
                extra={
                    'query_time_ms': query_time,
                    'result_count': len(result),
                    'params': query_params
                }
            )

            return result

        except Exception as e:
            self._metrics['errors'] += 1
            logger.error(
                f"Query failed for table: {table_name}",
                extra={'error': str(e), 'params': query_params}
            )
            raise IntegrationSyncError(
                message=f"Query execution failed: {str(e)}",
                sync_context={'table': table_name, 'params': query_params}
            )

    async def _ensure_initialized(self) -> None:
        """Ensure client is initialized before operations."""
        if not self._initialized:
            await self.initialize()

    async def _execute_with_retry(self, operation: callable) -> Any:
        """Execute operation with exponential backoff retry logic."""
        retry_config = self._config['retry_config']
        last_error = None

        for attempt in range(retry_config['max_retries']):
            try:
                return await operation()
            except BlitzyTablesError as e:
                last_error = e
                if not self._should_retry(e, attempt, retry_config):
                    break
                await asyncio.sleep(
                    min(
                        retry_config['backoff_factor'] ** attempt,
                        retry_config['max_backoff']
                    )
                )

        raise last_error

    def _should_retry(
        self,
        error: BlitzyTablesError,
        attempt: int,
        retry_config: Dict[str, Any]
    ) -> bool:
        """Determine if operation should be retried based on error and attempt count."""
        if attempt >= retry_config['max_retries']:
            return False

        # Retry on connection and timeout errors
        retriable_errors = {
            'ConnectionError',
            'TimeoutError',
            'ServiceUnavailable'
        }
        return error.__class__.__name__ in retriable_errors