"""
Google Calendar integration module for Customer Success AI Platform.
Provides secure OAuth2 authentication, rate-limited API access, and comprehensive
event management capabilities with robust error handling and retry mechanisms.

Dependencies:
- google-auth-oauthlib==1.0.0
- google-api-python-client==2.0.0
- tenacity==8.0.0
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build, Resource
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from ...config.integrations import GoogleCalendarSettings
from ...core.exceptions import IntegrationSyncError, RateLimitError

# Module configuration
SCOPES = ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"]
API_VERSION = "v3"
MAX_RETRIES = 3
BACKOFF_MULTIPLIER = 2

# Configure module logger
logger = logging.getLogger(__name__)

class GoogleCalendarClient:
    """
    Client for interacting with Google Calendar API with comprehensive error handling,
    rate limiting, and retry logic.
    """

    def __init__(self, settings: GoogleCalendarSettings):
        """
        Initialize Google Calendar client with settings and rate limit tracking.

        Args:
            settings: GoogleCalendarSettings instance with OAuth and rate limit configs
        """
        self._settings = settings
        self._credentials = None
        self._service: Optional[Resource] = None
        self._rate_limit_state = {
            "requests": 0,
            "window_start": datetime.now(),
            "window_size": 3600  # 1 hour window
        }
        
        # Configure logging
        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.INFO)

    def _check_rate_limit(self) -> None:
        """Check current rate limit status and reset if window expired."""
        current_time = datetime.now()
        window_elapsed = (current_time - self._rate_limit_state["window_start"]).total_seconds()
        
        if window_elapsed >= self._rate_limit_state["window_size"]:
            # Reset window
            self._rate_limit_state["requests"] = 0
            self._rate_limit_state["window_start"] = current_time
        
        if self._rate_limit_state["requests"] >= self._settings.rate_limit:
            raise RateLimitError(
                message="Google Calendar API rate limit exceeded",
                rate_limit_context={
                    "current_usage": self._rate_limit_state["requests"],
                    "limit": self._settings.rate_limit,
                    "reset_time": self._rate_limit_state["window_size"] - window_elapsed
                }
            )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=BACKOFF_MULTIPLIER),
        retry=retry_if_exception_type(Exception)
    )
    async def authenticate(self) -> None:
        """
        Authenticate with Google Calendar API using OAuth2.
        Implements retry logic with exponential backoff.
        """
        try:
            oauth_config = self._settings.get_oauth_config()
            flow = InstalledAppFlow.from_client_config(
                client_config={
                    'installed': {
                        'client_id': oauth_config['client_id'],
                        'client_secret': oauth_config['client_secret'],
                        'redirect_uris': [oauth_config['redirect_uri']],
                        'auth_uri': oauth_config['auth_uri'],
                        'token_uri': oauth_config['token_uri']
                    }
                },
                scopes=SCOPES
            )
            
            self._credentials = flow.run_local_server(port=0)
            self._service = build('calendar', API_VERSION, credentials=self._credentials)
            
            # Verify service connection
            self._service.calendarList().list().execute()
            
            self._logger.info("Successfully authenticated with Google Calendar API")
            
        except Exception as e:
            self._logger.error(f"Authentication failed: {str(e)}")
            raise IntegrationSyncError(
                message=f"Failed to authenticate with Google Calendar: {str(e)}",
                sync_context={"service": "google_calendar", "action": "authenticate"}
            )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=BACKOFF_MULTIPLIER),
        retry=retry_if_exception_type(Exception)
    )
    async def create_event(self, event_details: Dict) -> Dict:
        """
        Create a calendar event with validation and rate limiting.

        Args:
            event_details: Dictionary containing event details

        Returns:
            Dict: Created event details including ID and status
        """
        self._check_rate_limit()
        
        required_fields = ['summary', 'start', 'end']
        if not all(field in event_details for field in required_fields):
            raise ValueError(f"Missing required fields: {required_fields}")
        
        try:
            event = self._service.events().insert(
                calendarId='primary',
                body=event_details
            ).execute()
            
            self._rate_limit_state["requests"] += 1
            self._logger.info(f"Successfully created event: {event.get('id')}")
            
            return event
            
        except Exception as e:
            self._logger.error(f"Failed to create event: {str(e)}")
            raise IntegrationSyncError(
                message=f"Failed to create calendar event: {str(e)}",
                sync_context={"service": "google_calendar", "action": "create_event"}
            )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=BACKOFF_MULTIPLIER),
        retry=retry_if_exception_type(Exception)
    )
    async def update_event(self, event_id: str, event_details: Dict) -> Dict:
        """
        Update an existing calendar event with validation.

        Args:
            event_id: ID of the event to update
            event_details: Dictionary containing updated event details

        Returns:
            Dict: Updated event details
        """
        self._check_rate_limit()
        
        if not event_id:
            raise ValueError("Event ID is required")
            
        try:
            event = self._service.events().patch(
                calendarId='primary',
                eventId=event_id,
                body=event_details
            ).execute()
            
            self._rate_limit_state["requests"] += 1
            self._logger.info(f"Successfully updated event: {event_id}")
            
            return event
            
        except Exception as e:
            self._logger.error(f"Failed to update event {event_id}: {str(e)}")
            raise IntegrationSyncError(
                message=f"Failed to update calendar event: {str(e)}",
                sync_context={"service": "google_calendar", "action": "update_event"}
            )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=BACKOFF_MULTIPLIER),
        retry=retry_if_exception_type(Exception)
    )
    async def delete_event(self, event_id: str) -> bool:
        """
        Delete a calendar event with validation.

        Args:
            event_id: ID of the event to delete

        Returns:
            bool: Success status
        """
        self._check_rate_limit()
        
        if not event_id:
            raise ValueError("Event ID is required")
            
        try:
            self._service.events().delete(
                calendarId='primary',
                eventId=event_id
            ).execute()
            
            self._rate_limit_state["requests"] += 1
            self._logger.info(f"Successfully deleted event: {event_id}")
            
            return True
            
        except Exception as e:
            self._logger.error(f"Failed to delete event {event_id}: {str(e)}")
            raise IntegrationSyncError(
                message=f"Failed to delete calendar event: {str(e)}",
                sync_context={"service": "google_calendar", "action": "delete_event"}
            )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=BACKOFF_MULTIPLIER),
        retry=retry_if_exception_type(Exception)
    )
    async def get_events(self, start_time: datetime, end_time: datetime, max_results: int = 100) -> List[Dict]:
        """
        Get calendar events within a time range with pagination.

        Args:
            start_time: Start of time range
            end_time: End of time range
            max_results: Maximum number of events to return

        Returns:
            List[Dict]: List of calendar events
        """
        self._check_rate_limit()
        
        if not start_time or not end_time:
            raise ValueError("Start and end times are required")
        
        if start_time >= end_time:
            raise ValueError("Start time must be before end time")
            
        try:
            events = []
            page_token = None
            
            while True:
                self._check_rate_limit()
                
                events_result = self._service.events().list(
                    calendarId='primary',
                    timeMin=start_time.isoformat() + 'Z',
                    timeMax=end_time.isoformat() + 'Z',
                    maxResults=min(max_results - len(events), 100),
                    singleEvents=True,
                    orderBy='startTime',
                    pageToken=page_token
                ).execute()
                
                self._rate_limit_state["requests"] += 1
                events.extend(events_result.get('items', []))
                
                page_token = events_result.get('nextPageToken')
                if not page_token or len(events) >= max_results:
                    break
            
            self._logger.info(f"Successfully retrieved {len(events)} events")
            return events[:max_results]
            
        except Exception as e:
            self._logger.error(f"Failed to retrieve events: {str(e)}")
            raise IntegrationSyncError(
                message=f"Failed to retrieve calendar events: {str(e)}",
                sync_context={"service": "google_calendar", "action": "get_events"}
            )