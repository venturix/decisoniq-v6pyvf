"""
Integration tests for authentication endpoints in the Customer Success AI Platform.
Tests authentication flows, SSO integration, MFA setup, and security monitoring.

Version: pytest 7.x
Dependencies:
- pytest==7.x
- freezegun==1.x
- faker==18.x
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from typing import Dict, Any
from faker import Faker
from freezegun import freeze_time

from schemas.auth import UserLogin, Token, SecurityAudit
from core.exceptions import AuthenticationError
from core.security import FieldEncryption

# Initialize test constants
AUTH_PREFIX = '/auth'
fake = Faker()
PERFORMANCE_THRESHOLD = 3.0  # 3 second SLA requirement

@pytest.mark.integration
class TestAuthenticationAPI:
    """
    Comprehensive test suite for authentication API endpoints.
    Tests login flows, SSO, MFA, and security monitoring.
    """

    def setup_method(self):
        """Configure test environment and security context."""
        self.test_user_email = fake.email()
        self.test_user_password = fake.password(
            length=16,
            special_chars=True,
            digits=True,
            upper_case=True,
            lower_case=True
        )
        self.field_encryption = FieldEncryption()
        self.device_info = {
            'user_agent': 'Mozilla/5.0 (Test)',
            'ip_address': '127.0.0.1',
            'fingerprint': str(uuid4())
        }

    def teardown_method(self):
        """Cleanup test data and audit logs."""
        pass

    @pytest.mark.asyncio
    async def test_login_success(self, client, db_session, performance_monitor):
        """Test successful login with performance monitoring."""
        # Create test user
        user_data = {
            'email': self.test_user_email,
            'password': self.test_user_password,
            'device_info': self.device_info
        }

        # Start performance monitoring
        with performance_monitor() as monitor:
            response = await client.post(
                f"{AUTH_PREFIX}/login",
                json=user_data
            )

        # Verify response
        assert response.status_code == 200
        data = response.json()
        
        # Validate token structure
        assert 'access_token' in data
        assert 'token_type' in data
        assert data['token_type'] == 'bearer'
        assert 'expires_in' in data
        
        # Verify token expiration
        token_expiry = datetime.utcnow() + timedelta(minutes=30)
        assert abs((token_expiry - datetime.fromisoformat(data['expires_in'])).total_seconds()) < 5
        
        # Check performance
        assert monitor.duration < PERFORMANCE_THRESHOLD
        
        # Verify security audit
        audit_entry = db_session.query(SecurityAudit).filter_by(
            event_type='login_success'
        ).first()
        assert audit_entry is not None
        assert audit_entry.event_details['user_email'] == self.test_user_email
        assert audit_entry.device_info == self.device_info

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client, db_session):
        """Test login failure with invalid credentials."""
        user_data = {
            'email': self.test_user_email,
            'password': 'wrong_password',
            'device_info': self.device_info
        }

        response = await client.post(
            f"{AUTH_PREFIX}/login",
            json=user_data
        )

        assert response.status_code == 401
        data = response.json()
        assert 'detail' in data
        assert 'Invalid credentials' in data['detail']

        # Verify failed attempt logging
        audit_entry = db_session.query(SecurityAudit).filter_by(
            event_type='login_failed'
        ).first()
        assert audit_entry is not None
        assert audit_entry.event_details['failure_reason'] == 'invalid_credentials'

    @pytest.mark.asyncio
    async def test_mfa_setup(self, client, db_session):
        """Test MFA setup and verification."""
        # Login first
        login_response = await client.post(
            f"{AUTH_PREFIX}/login",
            json={
                'email': self.test_user_email,
                'password': self.test_user_password,
                'device_info': self.device_info
            }
        )
        token = login_response.json()['access_token']

        # Setup MFA
        response = await client.post(
            f"{AUTH_PREFIX}/mfa/setup",
            headers={'Authorization': f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        
        # Validate MFA setup response
        assert 'secret_key' in data
        assert 'qr_code' in data
        assert 'backup_codes' in data
        assert len(data['backup_codes']) == 10

        # Verify audit logging
        audit_entry = db_session.query(SecurityAudit).filter_by(
            event_type='mfa_setup'
        ).first()
        assert audit_entry is not None
        assert audit_entry.event_details['setup_successful'] is True

    @pytest.mark.asyncio
    async def test_sso_login(self, client, db_session):
        """Test SSO authentication flow."""
        # Mock SSO provider response
        sso_data = {
            'code': str(uuid4()),
            'state': str(uuid4()),
            'provider': 'auth0'
        }

        response = await client.post(
            f"{AUTH_PREFIX}/sso/callback",
            json=sso_data
        )

        assert response.status_code == 200
        data = response.json()
        
        # Validate SSO response
        assert 'access_token' in data
        assert 'token_type' in data
        assert 'user_info' in data
        
        # Verify SSO audit logging
        audit_entry = db_session.query(SecurityAudit).filter_by(
            event_type='sso_login'
        ).first()
        assert audit_entry is not None
        assert audit_entry.event_details['provider'] == 'auth0'

    @pytest.mark.asyncio
    async def test_rate_limiting(self, client, db_session):
        """Test login rate limiting."""
        # Attempt multiple rapid logins
        for _ in range(6):  # Exceeds 5 attempts limit
            await client.post(
                f"{AUTH_PREFIX}/login",
                json={
                    'email': self.test_user_email,
                    'password': 'wrong_password',
                    'device_info': self.device_info
                }
            )

        # Verify rate limit
        response = await client.post(
            f"{AUTH_PREFIX}/login",
            json={
                'email': self.test_user_email,
                'password': self.test_user_password,
                'device_info': self.device_info
            }
        )

        assert response.status_code == 429
        data = response.json()
        assert 'rate_limit_reset' in data

    @pytest.mark.asyncio
    async def test_token_refresh(self, client, db_session):
        """Test token refresh flow."""
        # Login to get initial tokens
        login_response = await client.post(
            f"{AUTH_PREFIX}/login",
            json={
                'email': self.test_user_email,
                'password': self.test_user_password,
                'device_info': self.device_info
            }
        )
        refresh_token = login_response.json()['refresh_token']

        # Refresh token
        response = await client.post(
            f"{AUTH_PREFIX}/token/refresh",
            json={'refresh_token': refresh_token}
        )

        assert response.status_code == 200
        data = response.json()
        assert 'access_token' in data
        assert 'refresh_token' in data

    @pytest.mark.asyncio
    async def test_session_management(self, client, db_session):
        """Test session management and device tracking."""
        # Login from new device
        new_device = {
            'user_agent': 'Mozilla/5.0 (New Device)',
            'ip_address': '192.168.1.1',
            'fingerprint': str(uuid4())
        }

        response = await client.post(
            f"{AUTH_PREFIX}/login",
            json={
                'email': self.test_user_email,
                'password': self.test_user_password,
                'device_info': new_device
            }
        )

        assert response.status_code == 200
        
        # Verify device registration
        audit_entry = db_session.query(SecurityAudit).filter_by(
            event_type='new_device_registered'
        ).first()
        assert audit_entry is not None
        assert audit_entry.device_info == new_device

    @pytest.mark.asyncio
    async def test_security_headers(self, client):
        """Test security headers on authentication endpoints."""
        response = await client.get(f"{AUTH_PREFIX}/status")
        
        # Verify security headers
        headers = response.headers
        assert headers['X-Frame-Options'] == 'DENY'
        assert headers['X-Content-Type-Options'] == 'nosniff'
        assert 'Strict-Transport-Security' in headers
        assert headers['X-XSS-Protection'] == '1; mode=block'