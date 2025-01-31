"""
Unit tests for core authentication functionality including Blitzy Enterprise SSO,
token management, MFA verification, and session handling.

Version: pytest 7.4.0
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timedelta
import json
from freezegun import freeze_time
import fakeredis
import uuid

from core.auth import BlitzyAuthManager
from config.security import SecuritySettings
from core.exceptions import AuthenticationError, RateLimitError

# Test constants
TEST_USER_DATA = {
    'email': 'test@example.com',
    'role': 'cs_manager',
    'permissions': ['read', 'write'],
    'mfa_enabled': True,
    'backup_codes': ['123456', '789012']
}

MOCK_SAML_RESPONSE = {
    'nameId': 'test@example.com',
    'attributes': {
        'role': 'cs_manager',
        'permissions': ['read', 'write'],
        'mfa_required': True
    }
}

class TestBlitzyAuthManager:
    """Test suite for BlitzyAuthManager functionality including enhanced security features."""

    def setup_method(self):
        """Setup test environment before each test."""
        # Initialize test security settings
        self.test_settings = SecuritySettings()
        self.test_settings.mfa_settings = {
            'enabled': True,
            'methods': ['totp'],
            'code_length': 6,
            'validity_period': 30
        }
        self.test_settings.rate_limit_config = {
            'enabled': True,
            'max_attempts': 5,
            'window_seconds': 300
        }

        # Setup fake Redis for session storage
        self.fake_redis = fakeredis.FakeStrictRedis()
        
        # Setup mocks
        self.mock_rate_limiter = Mock()
        self.mock_audit_logger = Mock()
        
        # Initialize auth manager with test configuration
        self.auth_manager = BlitzyAuthManager(
            security_settings=self.test_settings,
            session_store=self.fake_redis,
            rate_limiter=self.mock_rate_limiter,
            audit_logger=self.mock_audit_logger
        )

    def teardown_method(self):
        """Cleanup after each test."""
        # Clear Redis data
        self.fake_redis.flushall()
        
        # Reset mocks
        self.mock_rate_limiter.reset_mock()
        self.mock_audit_logger.reset_mock()

    @pytest.mark.asyncio
    async def test_saml_authentication_success(self):
        """Test successful SAML authentication flow with MFA verification."""
        # Mock SAML auth response
        mock_saml_auth = Mock()
        mock_saml_auth.is_authenticated.return_value = True
        mock_saml_auth.get_attributes.return_value = {
            'email': [TEST_USER_DATA['email']],
            'role': [TEST_USER_DATA['role']],
            'permissions': TEST_USER_DATA['permissions']
        }

        with patch('core.auth.OneLogin_Saml2_Auth', return_value=mock_saml_auth):
            # Test authentication with valid MFA code
            result = self.auth_manager.authenticate_saml(
                saml_response=MOCK_SAML_RESPONSE,
                mfa_code='123456'
            )

            # Verify authentication result
            assert result['user']['email'] == TEST_USER_DATA['email']
            assert 'access_token' in result
            assert 'refresh_token' in result
            assert 'session_id' in result
            
            # Verify session creation
            session = self.fake_redis.get(f"session:{result['session_id']}")
            assert session is not None
            session_data = json.loads(session)
            assert session_data['user_id'] is not None
            
            # Verify audit logging
            self.mock_audit_logger.log_auth_success.assert_called_once()

    @pytest.mark.asyncio
    async def test_mfa_verification(self):
        """Test MFA verification scenarios including TOTP and backup codes."""
        # Test valid TOTP code
        with patch('core.auth.pyotp.TOTP') as mock_totp:
            mock_totp.return_value.verify.return_value = True
            
            result = self.auth_manager.verify_mfa(
                user_id=str(uuid.uuid4()),
                mfa_code='123456'
            )
            assert result is True
            
            # Verify audit logging
            self.mock_audit_logger.log_mfa_verification.assert_called_with(
                user_id=mock_totp.call_args[0][0],
                success=True
            )

        # Test invalid TOTP code
        with patch('core.auth.pyotp.TOTP') as mock_totp:
            mock_totp.return_value.verify.return_value = False
            
            with pytest.raises(AuthenticationError) as exc_info:
                self.auth_manager.verify_mfa(
                    user_id=str(uuid.uuid4()),
                    mfa_code='invalid'
                )
            assert 'Invalid MFA code' in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_session_management(self):
        """Test session creation, validation and cleanup."""
        # Create test user and session
        user_id = str(uuid.uuid4())
        access_token = 'test_token'
        
        session_id = self.auth_manager._create_session(
            user={'id': user_id},
            access_token=access_token
        )
        
        # Verify session data
        session = self.fake_redis.get(f"session:{session_id}")
        assert session is not None
        session_data = json.loads(session)
        assert session_data['user_id'] == user_id
        assert session_data['access_token'] == access_token
        
        # Test session expiration
        with freeze_time(datetime.utcnow() + timedelta(minutes=31)):
            session = self.fake_redis.get(f"session:{session_id}")
            assert session is None

    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        """Test rate limiting functionality for authentication attempts."""
        test_email = 'test@example.com'
        
        # Configure rate limiter mock
        self.mock_rate_limiter.get_counter.return_value = 0
        
        # Test successful attempt
        assert self.auth_manager._check_rate_limit(test_email) is True
        self.mock_rate_limiter.increment.assert_called_once()
        
        # Test rate limit exceeded
        self.mock_rate_limiter.get_counter.return_value = 5
        assert self.auth_manager._check_rate_limit(test_email) is False
        
        # Verify rate limit error
        with pytest.raises(RateLimitError) as exc_info:
            self.auth_manager.authenticate_saml(
                saml_response={'email': test_email}
            )
        assert 'rate limit exceeded' in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_token_management(self):
        """Test access and refresh token generation and validation."""
        test_user = {'id': str(uuid.uuid4()), 'roles': ['cs_manager']}
        
        # Generate tokens
        access_token = self.auth_manager._create_access_token(test_user)
        refresh_token = self.auth_manager._create_refresh_token(test_user)
        
        assert access_token is not None
        assert refresh_token is not None
        
        # Test token expiration
        with freeze_time(datetime.utcnow() + timedelta(minutes=31)):
            with pytest.raises(AuthenticationError):
                self.auth_manager.verify_token(access_token)

    @pytest.mark.asyncio
    async def test_audit_logging(self):
        """Test comprehensive audit logging for authentication events."""
        # Test authentication audit
        self.auth_manager.audit_logger.log_auth_success(
            user_id=str(uuid.uuid4()),
            auth_method='saml_sso',
            session_id=str(uuid.uuid4())
        )
        self.mock_audit_logger.log_auth_success.assert_called_once()
        
        # Test MFA audit
        self.auth_manager.audit_logger.log_mfa_verification(
            user_id=str(uuid.uuid4()),
            success=True
        )
        self.mock_audit_logger.log_mfa_verification.assert_called_once()