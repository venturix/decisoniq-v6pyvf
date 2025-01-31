import React, { useState, useCallback, useEffect, memo } from 'react'; // ^18.0.0
import { useNavigate, useLocation } from 'react-router-dom'; // ^6.0.0
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0
import { toast } from '@blitzy/toast'; // ^1.0.0

// Internal imports
import { PlaybookList } from '../../components/playbooks/PlaybookList';
import { usePlaybook } from '../../hooks/usePlaybook';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { Analytics } from '../../utils/analytics';
import { useTheme } from '../../hooks/useTheme';

// Constants
const PAGE_TITLE = 'Customer Success Playbooks';
const CREATE_BUTTON_TEXT = 'Create New Playbook';
const ERROR_MESSAGES = {
  CREATE_ERROR: 'Failed to create playbook',
  NAVIGATION_ERROR: 'Failed to navigate to playbook'
} as const;

const ANALYTICS_EVENTS = {
  PLAYBOOK_CREATE: 'playbook_create',
  PLAYBOOK_SELECT: 'playbook_select'
} as const;

/**
 * Enhanced Playbooks page component with comprehensive error handling,
 * accessibility improvements, and performance optimizations
 */
export const PlaybooksPage: React.FC = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();

  // Playbook management hook with error handling
  const {
    playbooks,
    activePlaybook,
    loading,
    error,
    createPlaybook,
    setActivePlaybook,
    clearError
  } = usePlaybook();

  // Local loading state for optimistic updates
  const [isCreating, setIsCreating] = useState(false);

  // Handle playbook creation with error handling and analytics
  const handleCreatePlaybook = useCallback(async () => {
    setIsCreating(true);
    Analytics.trackEvent(ANALYTICS_EVENTS.PLAYBOOK_CREATE);

    try {
      const newPlaybook = await createPlaybook({
        name: 'New Playbook',
        description: 'New playbook description',
        steps: [],
        triggerType: 'MANUAL',
        triggerConditions: {}
      });

      navigate(`/playbooks/${newPlaybook.id}/edit`);
      toast.success('Playbook created successfully');
    } catch (err) {
      toast.error(ERROR_MESSAGES.CREATE_ERROR);
      console.error('Playbook creation error:', err);
    } finally {
      setIsCreating(false);
    }
  }, [createPlaybook, navigate]);

  // Handle playbook selection with error handling and analytics
  const handlePlaybookSelect = useCallback((playbookId: string) => {
    Analytics.trackEvent(ANALYTICS_EVENTS.PLAYBOOK_SELECT, { playbookId });

    try {
      setActivePlaybook(playbookId);
      navigate(`/playbooks/${playbookId}`);
    } catch (err) {
      toast.error(ERROR_MESSAGES.NAVIGATION_ERROR);
      console.error('Playbook navigation error:', err);
    }
  }, [setActivePlaybook, navigate]);

  // Clear errors on unmount
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  return (
    <ErrorBoundary
      fallback={
        <BlitzyUI.Alert
          severity="error"
          title="Error loading playbooks"
          action={
            <BlitzyUI.Button onClick={() => window.location.reload()}>
              Retry
            </BlitzyUI.Button>
          }
        />
      }
    >
      <div className="playbooks-page">
        {/* Page Header */}
        <header className="playbooks-header">
          <BlitzyUI.PageTitle>{PAGE_TITLE}</BlitzyUI.PageTitle>
          <BlitzyUI.Button
            variant="primary"
            onClick={handleCreatePlaybook}
            loading={isCreating}
            disabled={loading}
            startIcon={<BlitzyUI.Icon name="plus" />}
            aria-label={CREATE_BUTTON_TEXT}
          >
            {CREATE_BUTTON_TEXT}
          </BlitzyUI.Button>
        </header>

        {/* Main Content */}
        <main 
          className="playbooks-content"
          role="main"
          aria-label="Playbooks list"
        >
          <PlaybookList
            isLoading={loading}
            className="playbooks-list"
            onPlaybookSelect={handlePlaybookSelect}
            highContrast={theme.mode === 'high-contrast'}
          />
        </main>

        {/* Error Display */}
        {error && (
          <BlitzyUI.Alert
            severity="error"
            title="Error"
            message={error.message}
            onClose={clearError}
            className="playbooks-error"
          />
        )}
      </div>
    </ErrorBoundary>
  );
});

PlaybooksPage.displayName = 'PlaybooksPage';

export default PlaybooksPage;