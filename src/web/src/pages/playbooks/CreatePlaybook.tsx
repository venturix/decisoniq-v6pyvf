import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0

import PlaybookBuilder from '../../components/playbooks/PlaybookBuilder';
import PageHeader from '../../components/common/PageHeader';
import { createPlaybook } from '../../store/playbook/actions';
import { usePlaybook } from '../../hooks/usePlaybook';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useTheme } from '../../hooks/useTheme';
import type { Playbook, PlaybookStatus, PlaybookTriggerType } from '../../types/playbook';

interface CreatePlaybookState {
  isSaving: boolean;
  error: string | null;
  validationState: {
    isValid: boolean;
    errors: string[];
  };
  analyticsContext: {
    startTime: number;
    interactions: number;
  };
}

const CreatePlaybook: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const analytics = useAnalytics();
  const { error: playbookError } = usePlaybook();

  // Component state
  const [state, setState] = useState<CreatePlaybookState>({
    isSaving: false,
    error: null,
    validationState: {
      isValid: true,
      errors: []
    },
    analyticsContext: {
      startTime: Date.now(),
      interactions: 0
    }
  });

  // Initial playbook template
  const initialPlaybook = useMemo(() => ({
    name: '',
    description: '',
    steps: [],
    triggerType: PlaybookTriggerType.MANUAL,
    triggerConditions: {},
    status: PlaybookStatus.DRAFT
  }), []);

  // Handle playbook save
  const handleSave = useCallback(async (playbook: Playbook) => {
    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      analytics.track('playbook_create_attempt', {
        playbookName: playbook.name,
        stepCount: playbook.steps.length,
        triggerType: playbook.triggerType,
        creationTime: Date.now() - state.analyticsContext.startTime
      });

      await dispatch(createPlaybook(playbook));

      analytics.track('playbook_create_success', {
        playbookId: playbook.id,
        interactions: state.analyticsContext.interactions
      });

      BlitzyUI.Toast({
        title: 'Success',
        message: 'Playbook created successfully',
        type: 'success',
        duration: 5000
      });

      navigate('/playbooks');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create playbook';
      setState(prev => ({ ...prev, error: errorMessage }));

      analytics.track('playbook_create_error', {
        error: errorMessage,
        playbookData: playbook
      });

      BlitzyUI.Toast({
        title: 'Error',
        message: errorMessage,
        type: 'error',
        duration: 5000
      });
    } finally {
      setState(prev => ({ ...prev, isSaving: true }));
    }
  }, [dispatch, navigate, analytics, state.analyticsContext]);

  // Track user interactions
  const handleInteraction = useCallback(() => {
    setState(prev => ({
      ...prev,
      analyticsContext: {
        ...prev.analyticsContext,
        interactions: prev.analyticsContext.interactions + 1
      }
    }));
  }, []);

  // Error effect handler
  useEffect(() => {
    if (playbookError) {
      setState(prev => ({ ...prev, error: playbookError }));
    }
  }, [playbookError]);

  return (
    <ErrorBoundary
      fallback={
        <BlitzyUI.Alert
          title="Error"
          message="Failed to load playbook creator"
          type="error"
          className="m-4"
        />
      }
    >
      <div className="create-playbook-page">
        <PageHeader
          title="Create Playbook"
          subtitle="Design a new customer success playbook with automated actions and triggers"
          actions={
            <BlitzyUI.ButtonGroup>
              <BlitzyUI.Button
                variant="secondary"
                onClick={() => navigate('/playbooks')}
                disabled={state.isSaving}
              >
                Cancel
              </BlitzyUI.Button>
              <BlitzyUI.Button
                variant="primary"
                onClick={() => handleSave(initialPlaybook)}
                loading={state.isSaving}
                disabled={!state.validationState.isValid}
              >
                Save Playbook
              </BlitzyUI.Button>
            </BlitzyUI.ButtonGroup>
          }
        />

        <div className="p-6">
          {state.error && (
            <BlitzyUI.Alert
              title="Error"
              message={state.error}
              type="error"
              className="mb-6"
              onClose={() => setState(prev => ({ ...prev, error: null }))}
            />
          )}

          <PlaybookBuilder
            initialPlaybook={initialPlaybook}
            onSave={handleSave}
            className="bg-surface rounded-lg shadow-sm"
            onInteraction={handleInteraction}
            theme={theme}
            validationMode="strict"
            accessibilityMode="enhanced"
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default CreatePlaybook;