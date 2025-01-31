"""
Unit tests for core security functionality including encryption, hashing, and security utilities.
Tests validate cryptographic operations, key management, and security protocols.

Version: 1.0.0
"""

import pytest  # v7.x
import base64
import os
from src.core.security import (
    generate_salt,
    derive_key,
    encrypt_field,
    decrypt_field,
    FieldEncryption
)

# Test constants
TEST_PASSWORD = "test_password123"
TEST_FIELD_VALUE = "sensitive_data"
ENCRYPTION_KEY_LENGTH = 32
SALT_LENGTH = 16

@pytest.mark.unit
def test_generate_salt():
    """Test salt generation functionality with entropy validation."""
    # Test default salt generation
    salt = generate_salt()
    assert isinstance(salt, bytes)
    assert len(salt) == 32  # Default length

    # Test salt uniqueness
    salt2 = generate_salt()
    assert salt != salt2

    # Test custom lengths
    custom_salt = generate_salt(length=24)
    assert len(custom_salt) == 24

    # Test entropy validation
    unique_bytes = len(set(salt))
    assert unique_bytes > SALT_LENGTH, "Salt should have sufficient entropy"

    # Test minimum length validation
    with pytest.raises(ValueError, match="Salt length must be at least 16 bytes"):
        generate_salt(length=8)

    # Test invalid length type
    with pytest.raises(TypeError):
        generate_salt(length="invalid")

@pytest.mark.unit
def test_derive_key():
    """Test key derivation functionality with strength validation."""
    # Generate test salt
    salt = generate_salt(SALT_LENGTH)

    # Test basic key derivation
    key = derive_key(TEST_PASSWORD, salt)
    assert isinstance(key, bytes)
    assert len(key) == ENCRYPTION_KEY_LENGTH

    # Test key derivation consistency
    key2 = derive_key(TEST_PASSWORD, salt)
    assert key == key2, "Same password and salt should produce same key"

    # Test different passwords produce different keys
    different_key = derive_key("different_password", salt)
    assert key != different_key

    # Test different salts produce different keys
    different_salt = generate_salt(SALT_LENGTH)
    key3 = derive_key(TEST_PASSWORD, different_salt)
    assert key != key3

    # Test empty password validation
    with pytest.raises(ValueError, match="Password and salt are required"):
        derive_key("", salt)

    # Test None password validation
    with pytest.raises(ValueError, match="Password and salt are required"):
        derive_key(None, salt)

    # Test invalid salt validation
    with pytest.raises(ValueError, match="Password and salt are required"):
        derive_key(TEST_PASSWORD, None)

@pytest.mark.unit
def test_field_encryption():
    """Test field encryption and decryption with integrity verification."""
    # Generate encryption key
    key = base64.b64encode(os.urandom(ENCRYPTION_KEY_LENGTH)).decode()

    # Test basic encryption/decryption
    encrypted = encrypt_field(TEST_FIELD_VALUE, key)
    assert encrypted != TEST_FIELD_VALUE
    assert ":" in encrypted  # Version separator
    version, _ = encrypted.split(":", 1)
    assert version == "1"  # Current version

    # Test decryption
    decrypted = decrypt_field(encrypted, key)
    assert decrypted == TEST_FIELD_VALUE

    # Test empty value handling
    with pytest.raises(ValueError, match="Value and key are required"):
        encrypt_field("", key)

    # Test None value handling
    with pytest.raises(ValueError, match="Value and key are required"):
        encrypt_field(None, key)

    # Test invalid key handling
    with pytest.raises(ValueError, match="Value and key are required"):
        encrypt_field(TEST_FIELD_VALUE, "")

    # Test special characters
    special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    encrypted_special = encrypt_field(special_chars, key)
    decrypted_special = decrypt_field(encrypted_special, key)
    assert decrypted_special == special_chars

    # Test Unicode characters
    unicode_text = "Hello 世界"
    encrypted_unicode = encrypt_field(unicode_text, key)
    decrypted_unicode = decrypt_field(encrypted_unicode, key)
    assert decrypted_unicode == unicode_text

    # Test incorrect key for decryption
    wrong_key = base64.b64encode(os.urandom(ENCRYPTION_KEY_LENGTH)).decode()
    with pytest.raises(Exception):
        decrypt_field(encrypted, wrong_key)

@pytest.mark.unit
def test_field_encryption_class():
    """Test FieldEncryption class functionality with key rotation."""
    # Initialize encryption instance
    field_encryption = FieldEncryption()

    # Test basic encryption
    encrypted = field_encryption.encrypt(TEST_FIELD_VALUE)
    assert encrypted != TEST_FIELD_VALUE
    assert ":" in encrypted

    # Test decryption
    decrypted = field_encryption.decrypt(encrypted)
    assert decrypted == TEST_FIELD_VALUE

    # Test key rotation
    assert field_encryption.rotate_keys()
    
    # Test encryption with new key
    new_encrypted = field_encryption.encrypt(TEST_FIELD_VALUE)
    assert new_encrypted != encrypted
    new_decrypted = field_encryption.decrypt(new_encrypted)
    assert new_decrypted == TEST_FIELD_VALUE

    # Test decryption of old value after rotation
    old_decrypted = field_encryption.decrypt(encrypted)
    assert old_decrypted == TEST_FIELD_VALUE

    # Test empty value handling
    with pytest.raises(ValueError, match="Value is required"):
        field_encryption.encrypt("")

    with pytest.raises(ValueError, match="Encrypted value is required"):
        field_encryption.decrypt("")

    # Test None value handling
    with pytest.raises(ValueError, match="Value is required"):
        field_encryption.encrypt(None)

    with pytest.raises(ValueError, match="Encrypted value is required"):
        field_encryption.decrypt(None)

    # Test large data handling
    large_data = "x" * 1000000  # 1MB of data
    encrypted_large = field_encryption.encrypt(large_data)
    decrypted_large = field_encryption.decrypt(encrypted_large)
    assert decrypted_large == large_data

    # Test invalid version handling
    invalid_version = "999:invaliddata"
    with pytest.raises(ValueError, match="Unsupported encryption version"):
        field_encryption.decrypt(invalid_version)