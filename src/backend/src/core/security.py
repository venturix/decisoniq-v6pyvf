"""
Core security implementation module for Customer Success AI Platform.
Provides encryption, hashing, and security utility functions with comprehensive audit logging.

Version: 1.0.0
"""

import os
import base64
from typing import Dict, Optional
from cryptography.fernet import Fernet  # v41.0.0
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes  # v41.0.0
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC  # v41.0.0
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from passlib.context import CryptContext  # v1.7.4
import logging
from config.security import SecuritySettings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global constants
ENCRYPTION_SCHEMES = ['bcrypt', 'argon2']
PASSWORD_CONTEXT = CryptContext(schemes=ENCRYPTION_SCHEMES, deprecated='auto')
KEY_DERIVATION_ITERATIONS = 100000
ENCRYPTION_VERSION = '1'

def generate_salt(length: int = 32) -> bytes:
    """
    Generate a cryptographically secure random salt.
    
    Args:
        length: Length of salt in bytes (default: 32)
        
    Returns:
        bytes: Cryptographically secure random salt
        
    Raises:
        ValueError: If length is less than 16 bytes
    """
    if length < 16:
        raise ValueError("Salt length must be at least 16 bytes")
    
    try:
        salt = os.urandom(length)
        # Validate entropy
        if len(set(salt)) < length // 2:
            raise ValueError("Generated salt has insufficient entropy")
        return salt
    except Exception as e:
        logger.error(f"Salt generation failed: {str(e)}")
        raise

def derive_key(password: str, salt: bytes) -> bytes:
    """
    Derive an encryption key using PBKDF2.
    
    Args:
        password: Password to derive key from
        salt: Salt for key derivation
        
    Returns:
        bytes: Derived encryption key
        
    Raises:
        ValueError: If password or salt is invalid
    """
    if not password or not salt:
        raise ValueError("Password and salt are required")
    
    try:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,  # 256-bit key
            salt=salt,
            iterations=KEY_DERIVATION_ITERATIONS,
            backend=default_backend()
        )
        key = kdf.derive(password.encode())
        return key
    except Exception as e:
        logger.error(f"Key derivation failed: {str(e)}")
        raise

def encrypt_field(value: str, key: str) -> str:
    """
    Encrypt a field value using AES-256-GCM.
    
    Args:
        value: Value to encrypt
        key: Encryption key
        
    Returns:
        str: Base64 encoded encrypted value with IV
        
    Raises:
        ValueError: If value or key is invalid
    """
    if not value or not key:
        raise ValueError("Value and key are required")
    
    try:
        # Generate a random IV
        iv = os.urandom(12)
        
        # Create cipher
        cipher = Cipher(
            algorithms.AES(base64.b64decode(key)),
            modes.GCM(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        # Add padding
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(value.encode()) + padder.finalize()
        
        # Encrypt
        ciphertext = encryptor.update(padded_data) + encryptor.finalize()
        
        # Combine IV, ciphertext and tag
        encrypted_data = iv + encryptor.tag + ciphertext
        
        # Add version and encode
        versioned_data = f"{ENCRYPTION_VERSION}:{base64.b64encode(encrypted_data).decode()}"
        return versioned_data
    except Exception as e:
        logger.error(f"Field encryption failed: {str(e)}")
        raise

def decrypt_field(encrypted_value: str, key: str) -> str:
    """
    Decrypt an encrypted field value.
    
    Args:
        encrypted_value: Encrypted value to decrypt
        key: Decryption key
        
    Returns:
        str: Decrypted value
        
    Raises:
        ValueError: If encrypted_value or key is invalid
    """
    if not encrypted_value or not key:
        raise ValueError("Encrypted value and key are required")
    
    try:
        # Split version and data
        version, data = encrypted_value.split(':', 1)
        if version != ENCRYPTION_VERSION:
            raise ValueError(f"Unsupported encryption version: {version}")
        
        # Decode data
        decoded_data = base64.b64decode(data)
        
        # Extract IV, tag and ciphertext
        iv = decoded_data[:12]
        tag = decoded_data[12:28]
        ciphertext = decoded_data[28:]
        
        # Create cipher
        cipher = Cipher(
            algorithms.AES(base64.b64decode(key)),
            modes.GCM(iv, tag),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        
        # Decrypt
        padded_data = decryptor.update(ciphertext) + decryptor.finalize()
        
        # Remove padding
        unpadder = padding.PKCS7(128).unpadder()
        data = unpadder.update(padded_data) + unpadder.finalize()
        
        return data.decode()
    except Exception as e:
        logger.error(f"Field decryption failed: {str(e)}")
        raise

class FieldEncryption:
    """
    Handles field-level encryption with key rotation support.
    """
    
    def __init__(self):
        """Initialize field encryption with configuration from settings."""
        try:
            settings = SecuritySettings()
            config = settings.get_encryption_config()
            
            self._encryption_key = config['key']
            self._fernet = Fernet(base64.b64encode(derive_key(
                self._encryption_key,
                generate_salt()
            )))
            
            # Initialize key versions
            self._key_versions = {
                'current': self._encryption_key,
                'previous': None,
                'next': None
            }
            
            logger.info("Field encryption initialized successfully")
        except Exception as e:
            logger.error(f"Field encryption initialization failed: {str(e)}")
            raise
    
    def encrypt(self, value: str) -> str:
        """
        Encrypt a value with version tracking.
        
        Args:
            value: Value to encrypt
            
        Returns:
            str: Encrypted value with version
        """
        try:
            if not value:
                raise ValueError("Value is required")
            
            # Encrypt using current key version
            encrypted = encrypt_field(value, self._key_versions['current'])
            logger.info("Field encryption successful")
            return encrypted
        except Exception as e:
            logger.error(f"Field encryption failed: {str(e)}")
            raise
    
    def decrypt(self, encrypted_value: str) -> str:
        """
        Decrypt a value with version handling.
        
        Args:
            encrypted_value: Encrypted value to decrypt
            
        Returns:
            str: Decrypted value
        """
        try:
            if not encrypted_value:
                raise ValueError("Encrypted value is required")
            
            # Extract version and decrypt
            version = encrypted_value.split(':', 1)[0]
            key = self._key_versions['current']
            
            # Handle old versions
            if version != ENCRYPTION_VERSION and self._key_versions['previous']:
                key = self._key_versions['previous']
            
            decrypted = decrypt_field(encrypted_value, key)
            logger.info("Field decryption successful")
            return decrypted
        except Exception as e:
            logger.error(f"Field decryption failed: {str(e)}")
            raise
    
    def rotate_keys(self) -> bool:
        """
        Perform key rotation with secure backup.
        
        Returns:
            bool: Success status
        """
        try:
            # Generate new key
            new_key = base64.b64encode(os.urandom(32)).decode()
            
            # Backup current key
            self._key_versions['previous'] = self._key_versions['current']
            
            # Update current key
            self._key_versions['current'] = new_key
            self._encryption_key = new_key
            
            # Update Fernet instance
            self._fernet = Fernet(base64.b64encode(derive_key(
                self._encryption_key,
                generate_salt()
            )))
            
            logger.info("Key rotation completed successfully")
            return True
        except Exception as e:
            logger.error(f"Key rotation failed: {str(e)}")
            raise