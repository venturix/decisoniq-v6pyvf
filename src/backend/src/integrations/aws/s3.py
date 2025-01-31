"""
AWS S3 Integration Module

Provides enterprise-grade S3 operations for managing ML model artifacts, customer data files,
and other object storage needs with enhanced security features.

Dependencies:
- boto3==1.28+
- botocore==1.31+
"""

import os
import logging
import mimetypes
from typing import Dict, List, Optional, Any
import boto3
from botocore.exceptions import ClientError
from config.aws import s3_config, get_boto3_session, get_kms_key
from core.exceptions import IntegrationSyncError

# Configure logging with structured format
logger = logging.getLogger(__name__)

# Constants
DEFAULT_EXPIRATION = 3600  # Default presigned URL expiration in seconds
MAX_RETRIES = 3  # Maximum number of retry attempts for S3 operations

class S3Client:
    """
    High-level S3 client for managing object storage operations with enhanced security
    and enterprise features.
    """

    def __init__(self, retry_config: Optional[Dict[str, Any]] = None) -> None:
        """
        Initialize S3 client with secure configuration and retry policies.

        Args:
            retry_config: Optional custom retry configuration
        """
        self._config = s3_config
        session = get_boto3_session()
        
        # Configure retry and connection settings
        self._retry_config = retry_config or {
            'max_attempts': MAX_RETRIES,
            'mode': 'adaptive',
            'max_pool_connections': 50
        }
        
        # Initialize S3 client with retry configuration
        self._client = session.client(
            's3',
            config=boto3.client.Config(**self._retry_config)
        )
        
        # Get KMS key for encryption
        self._kms_key_id = get_kms_key() if self._config['encryption']['kms_key'] else None

    def upload_file(
        self,
        file_path: str,
        bucket_name: str,
        object_key: str,
        metadata: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Uploads a file to S3 with mandatory encryption and content type detection.

        Args:
            file_path: Local path to file
            bucket_name: Target S3 bucket name
            object_key: Target S3 object key
            metadata: Optional metadata dictionary

        Returns:
            str: S3 object URL

        Raises:
            IntegrationSyncError: If upload fails
        """
        try:
            # Validate file existence
            if not os.path.exists(file_path):
                raise IntegrationSyncError(
                    message=f"File not found: {file_path}",
                    sync_context={"operation": "upload", "file_path": file_path}
                )

            # Detect content type
            content_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'

            # Prepare upload parameters with encryption
            upload_args = {
                'Bucket': bucket_name,
                'Key': object_key,
                'ContentType': content_type,
                'ServerSideEncryption': 'aws:kms' if self._kms_key_id else 'AES256',
                'Metadata': metadata or {}
            }

            if self._kms_key_id:
                upload_args['SSEKMSKeyId'] = self._kms_key_id

            # Upload file with multipart support for large files
            self._client.upload_file(
                Filename=file_path,
                **upload_args
            )

            # Generate and return object URL
            url = f"https://{bucket_name}.s3.amazonaws.com/{object_key}"
            logger.info(
                "File uploaded successfully",
                extra={
                    "bucket": bucket_name,
                    "key": object_key,
                    "content_type": content_type,
                    "encrypted": bool(self._kms_key_id)
                }
            )
            return url

        except ClientError as e:
            raise IntegrationSyncError(
                message=f"Failed to upload file: {str(e)}",
                sync_context={
                    "operation": "upload",
                    "file_path": file_path,
                    "bucket": bucket_name,
                    "key": object_key
                }
            )

    def download_file(
        self,
        bucket_name: str,
        object_key: str,
        destination_path: str
    ) -> str:
        """
        Downloads a file from S3 with integrity verification.

        Args:
            bucket_name: Source S3 bucket name
            object_key: Source S3 object key
            destination_path: Local destination path

        Returns:
            str: Local file path

        Raises:
            IntegrationSyncError: If download fails
        """
        try:
            # Ensure destination directory exists
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)

            # Download file with integrity check
            self._client.download_file(
                Bucket=bucket_name,
                Key=object_key,
                Filename=destination_path,
                ExtraArgs={'ChecksumMode': 'ENABLED'}
            )

            logger.info(
                "File downloaded successfully",
                extra={
                    "bucket": bucket_name,
                    "key": object_key,
                    "destination": destination_path
                }
            )
            return destination_path

        except ClientError as e:
            raise IntegrationSyncError(
                message=f"Failed to download file: {str(e)}",
                sync_context={
                    "operation": "download",
                    "bucket": bucket_name,
                    "key": object_key,
                    "destination": destination_path
                }
            )

    def delete_file(self, bucket_name: str, object_key: str) -> bool:
        """
        Deletes a file from S3 with compliance checks.

        Args:
            bucket_name: S3 bucket name
            object_key: S3 object key

        Returns:
            bool: Success status

        Raises:
            IntegrationSyncError: If deletion fails
        """
        try:
            # Check object existence and retention policy
            response = self._client.head_object(
                Bucket=bucket_name,
                Key=object_key
            )

            # Verify no legal hold
            if response.get('LegalHold', {}).get('Status') == 'ON':
                raise IntegrationSyncError(
                    message="Object is under legal hold",
                    sync_context={
                        "operation": "delete",
                        "bucket": bucket_name,
                        "key": object_key
                    }
                )

            # Delete object
            self._client.delete_object(
                Bucket=bucket_name,
                Key=object_key
            )

            logger.info(
                "File deleted successfully",
                extra={
                    "bucket": bucket_name,
                    "key": object_key
                }
            )
            return True

        except ClientError as e:
            raise IntegrationSyncError(
                message=f"Failed to delete file: {str(e)}",
                sync_context={
                    "operation": "delete",
                    "bucket": bucket_name,
                    "key": object_key
                }
            )

    def list_files(
        self,
        bucket_name: str,
        prefix: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Lists files in an S3 bucket/prefix with pagination and filtering.

        Args:
            bucket_name: S3 bucket name
            prefix: Optional key prefix filter
            filters: Optional additional filters

        Returns:
            List[Dict[str, Any]]: List of object metadata

        Raises:
            IntegrationSyncError: If listing fails
        """
        try:
            paginator = self._client.get_paginator('list_objects_v2')
            list_args = {
                'Bucket': bucket_name,
                'PaginationConfig': {'MaxItems': 1000}
            }

            if prefix:
                list_args['Prefix'] = prefix

            objects = []
            for page in paginator.paginate(**list_args):
                if 'Contents' in page:
                    for obj in page['Contents']:
                        # Apply custom filters if provided
                        if filters and not self._apply_filters(obj, filters):
                            continue
                        
                        objects.append({
                            'key': obj['Key'],
                            'size': obj['Size'],
                            'last_modified': obj['LastModified'].isoformat(),
                            'etag': obj['ETag'],
                            'storage_class': obj['StorageClass']
                        })

            logger.info(
                "Files listed successfully",
                extra={
                    "bucket": bucket_name,
                    "prefix": prefix,
                    "count": len(objects)
                }
            )
            return objects

        except ClientError as e:
            raise IntegrationSyncError(
                message=f"Failed to list files: {str(e)}",
                sync_context={
                    "operation": "list",
                    "bucket": bucket_name,
                    "prefix": prefix
                }
            )

    def get_file_url(
        self,
        bucket_name: str,
        object_key: str,
        expiration: int = DEFAULT_EXPIRATION
    ) -> str:
        """
        Generates a secure presigned URL for file access.

        Args:
            bucket_name: S3 bucket name
            object_key: S3 object key
            expiration: URL expiration in seconds

        Returns:
            str: Presigned URL

        Raises:
            IntegrationSyncError: If URL generation fails
        """
        try:
            # Generate presigned URL with security headers
            url = self._client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': bucket_name,
                    'Key': object_key,
                    'ResponseContentDisposition': 'attachment'
                },
                ExpiresIn=expiration,
                HttpMethod='GET'
            )

            logger.info(
                "Presigned URL generated successfully",
                extra={
                    "bucket": bucket_name,
                    "key": object_key,
                    "expiration": expiration
                }
            )
            return url

        except ClientError as e:
            raise IntegrationSyncError(
                message=f"Failed to generate presigned URL: {str(e)}",
                sync_context={
                    "operation": "presign",
                    "bucket": bucket_name,
                    "key": object_key
                }
            )

    def _apply_filters(self, obj: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        """
        Applies custom filters to S3 objects.

        Args:
            obj: Object metadata
            filters: Filter criteria

        Returns:
            bool: Whether object matches filters
        """
        for key, value in filters.items():
            if key in obj and obj[key] != value:
                return False
        return True