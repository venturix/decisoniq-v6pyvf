"""
Database configuration module for the Customer Success AI Platform.
Manages database connection settings, engine configuration, and connection pooling
with support for high availability and security features.
"""

import os
import logging
import ssl
from typing import Dict, Optional
from pydantic import dataclasses, validator
from sqlalchemy import create_engine, exc
from sqlalchemy.pool import QueuePool
from ..core.exceptions import BaseCustomException

# Constants for default configuration
DEFAULT_DATABASE_URL = 'postgresql+psycopg2://postgres:postgres@localhost:5432/csai'
DEFAULT_POOL_SIZE = 5
DEFAULT_MAX_OVERFLOW = 10
DEFAULT_POOL_TIMEOUT = 30

# Configure module logger
logger = logging.getLogger(__name__)

# Database error codes mapping
DATABASE_ERROR_CODES = {
    'CONNECTION_ERROR': 'DB001',
    'VALIDATION_ERROR': 'DB002',
    'POOL_ERROR': 'DB003'
}

class DatabaseError(BaseCustomException):
    """Custom exception for database-related errors."""
    def __init__(self, message: str, error_code: str, metadata: Optional[Dict] = None):
        super().__init__(message=message, error_code=error_code, metadata=metadata)

@dataclasses.dataclass
class DatabaseSettings:
    """Database configuration settings with high availability and security support."""
    
    # Connection parameters
    host: str = dataclasses.field(default_factory=lambda: os.getenv('DB_HOST', 'localhost'))
    port: int = dataclasses.field(default_factory=lambda: int(os.getenv('DB_PORT', '5432')))
    username: str = dataclasses.field(default_factory=lambda: os.getenv('DB_USER', 'postgres'))
    password: str = dataclasses.field(default_factory=lambda: os.getenv('DB_PASSWORD', 'postgres'))
    database: str = dataclasses.field(default_factory=lambda: os.getenv('DB_NAME', 'csai'))
    schema: str = dataclasses.field(default_factory=lambda: os.getenv('DB_SCHEMA', 'public'))
    
    # Connection pool settings
    pool_size: int = dataclasses.field(default_factory=lambda: int(os.getenv('DB_POOL_SIZE', str(DEFAULT_POOL_SIZE))))
    max_overflow: int = dataclasses.field(default_factory=lambda: int(os.getenv('DB_MAX_OVERFLOW', str(DEFAULT_MAX_OVERFLOW))))
    pool_timeout: int = dataclasses.field(default_factory=lambda: int(os.getenv('DB_POOL_TIMEOUT', str(DEFAULT_POOL_TIMEOUT))))
    
    # Security settings
    ssl_enabled: bool = dataclasses.field(default_factory=lambda: os.getenv('DB_SSL_ENABLED', 'false').lower() == 'true')
    ssl_cert_path: str = dataclasses.field(default_factory=lambda: os.getenv('DB_SSL_CERT_PATH', ''))
    ssl_key_path: str = dataclasses.field(default_factory=lambda: os.getenv('DB_SSL_KEY_PATH', ''))
    ssl_ca_path: str = dataclasses.field(default_factory=lambda: os.getenv('DB_SSL_CA_PATH', ''))
    
    # High availability settings
    replica_hosts: str = dataclasses.field(default_factory=lambda: os.getenv('DB_REPLICA_HOSTS', ''))
    read_only: bool = dataclasses.field(default_factory=lambda: os.getenv('DB_READ_ONLY', 'false').lower() == 'true')
    
    # Debug settings
    echo_sql: bool = dataclasses.field(default_factory=lambda: os.getenv('DB_ECHO_SQL', 'false').lower() == 'true')

    @validator('port')
    def validate_port(cls, v):
        if not 1 <= v <= 65535:
            raise DatabaseError(
                message=f"Invalid port number: {v}",
                error_code=DATABASE_ERROR_CODES['VALIDATION_ERROR']
            )
        return v

    def get_connection_url(self) -> str:
        """Generate database connection URL with security parameters."""
        try:
            # Base connection URL
            url = f"postgresql+psycopg2://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
            
            # Add SSL parameters if enabled
            if self.ssl_enabled:
                url += "?sslmode=verify-full"
                if self.ssl_cert_path:
                    url += f"&sslcert={self.ssl_cert_path}"
                if self.ssl_key_path:
                    url += f"&sslkey={self.ssl_key_path}"
                if self.ssl_ca_path:
                    url += f"&sslrootcert={self.ssl_ca_path}"
            
            # Add read replica configuration if specified
            if self.replica_hosts and self.read_only:
                url += f"&target_session_attrs={'read-only' if self.read_only else 'any'}"
                url += f"&hostaddr={self.replica_hosts}"
            
            return url
        except Exception as e:
            raise DatabaseError(
                message=f"Failed to generate connection URL: {str(e)}",
                error_code=DATABASE_ERROR_CODES['CONNECTION_ERROR']
            )

    def configure_ssl_context(self) -> Optional[ssl.SSLContext]:
        """Configure SSL context for secure database connections."""
        if not self.ssl_enabled:
            return None
        
        try:
            context = ssl.create_default_context(
                purpose=ssl.Purpose.SERVER_AUTH,
                cafile=self.ssl_ca_path if self.ssl_ca_path else None
            )
            
            if self.ssl_cert_path and self.ssl_key_path:
                context.load_cert_chain(
                    certfile=self.ssl_cert_path,
                    keyfile=self.ssl_key_path
                )
            
            context.verify_mode = ssl.CERT_REQUIRED
            context.check_hostname = True
            
            return context
        except Exception as e:
            raise DatabaseError(
                message=f"Failed to configure SSL context: {str(e)}",
                error_code=DATABASE_ERROR_CODES['CONNECTION_ERROR']
            )

    def get_engine_args(self) -> Dict:
        """Return SQLAlchemy engine configuration with security and performance settings."""
        args = {
            'pool_size': self.pool_size,
            'max_overflow': self.max_overflow,
            'pool_timeout': self.pool_timeout,
            'pool_pre_ping': True,
            'pool_recycle': 3600,
            'echo': self.echo_sql,
            'poolclass': QueuePool,
            'connect_args': {
                'connect_timeout': 10,
                'application_name': 'csai_platform',
                'options': f'-c search_path={self.schema}'
            }
        }

        # Configure SSL if enabled
        if self.ssl_enabled:
            ssl_context = self.configure_ssl_context()
            if ssl_context:
                args['connect_args']['ssl_context'] = ssl_context

        return args

    def validate_connection(self) -> bool:
        """Validate database connection with comprehensive testing."""
        try:
            engine = create_engine(
                self.get_connection_url(),
                **self.get_engine_args()
            )

            # Test connection
            with engine.connect() as conn:
                conn.execute("SELECT 1")

            # Test schema access
            with engine.connect() as conn:
                conn.execute(f"SET search_path TO {self.schema}")

            # Validate read replicas if configured
            if self.replica_hosts and self.read_only:
                for replica in self.replica_hosts.split(','):
                    temp_host = self.host
                    self.host = replica.strip()
                    test_engine = create_engine(
                        self.get_connection_url(),
                        **self.get_engine_args()
                    )
                    with test_engine.connect() as conn:
                        conn.execute("SELECT 1")
                    self.host = temp_host

            logger.info("Database connection validation successful")
            return True

        except exc.SQLAlchemyError as e:
            logger.error(f"Database connection validation failed: {str(e)}")
            raise DatabaseError(
                message=f"Database connection validation failed: {str(e)}",
                error_code=DATABASE_ERROR_CODES['CONNECTION_ERROR']
            )