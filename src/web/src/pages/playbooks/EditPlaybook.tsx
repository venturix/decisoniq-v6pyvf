import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0
import DashboardLayout from '../../layouts/DashboardLayout';
import PlaybookBuilder from '../../components/playbooks/PlaybookBuilder';
import { usePlaybook } from '../../hooks/usePlaybook';
import { useNotification } from '../../hooks/useNotification';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useAnalytics } from '../../hooks/useAnalytics';
import type { Playbook, PlaybookValidationError } from '../../types/playbook';

// Constants for configuration
const NOTIFICATION_DURATION = 3000;
const AUTOSAVE_INTERVAL = 30000;
const MAX_UNDO_STEPS = 50;

const ERROR_MESSAGES = {
  LOAD_ERROR: 'Failed to load playbook',
  SAVE_ERROR: 'Failed to save changes',
  NOT_FOUND: 'Playbook not found',
  VALIDATION_ERROR: 'Please fix validation errors before saving',
  NETWORK_ERROR: 'Network error occurred',
  PERMISSION_ERROR: 'Insufficient permissions'
} as const;

const ANALYTICS_EVENTS = {
  PLAYBOOK_EDIT_START: 'playbook_edit_start',
  PLAYBOOK_SAVE_ATTEMPT: 'playbook_save_attempt',
  PLAYBOOK_SAVE_SUCCESS: 'playbook_save_success',
  PLAYBOOK_SAVE_ERROR: 'playbook_save_error',
  PLAYBOOK_VALIDATION_ERROR: 'playbook_validation_error'
} as const;

interface EditPlaybookParams {
  id: string;
}

const EditPlaybook: React.FC = () => {
  const { id } = useParams<EditPlaybookParams>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showNotification } = useNotification();
  const { trackEvent } = useAnalytics();

  // Playbook state management
  const {
    activePlaybook,
    updatePlaybook,
    loading,
    error
  } = usePlaybook();

  // Local state
  const [validationErrors, setValidationErrors] = useState<PlaybookValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const undoStackRef = useRef<Playbook[]>([]);
  const redoStackRef = useRef<Playbook[]>([]);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();

  // Track initial load
  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.PLAYBOOK_EDIT_START, { playbookId: id });
  }, [id, trackEvent]);

  // Handle autosave
  useEffect(() => {
    if (hasUnsavedChanges && !isSaving && activePlaybook) {
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(activePlaybook);
      }, AUTOSAVE_INTERVAL);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, isSaving, activePlaybook]);

  // Validate playbook data
  const validatePlaybook = useCallback((playbook: Playbook): PlaybookValidationError[] => {
    const errors: PlaybookValidationError[] = [];

    if (!playbook.name?.trim()) {
      errors.push({ field: 'name', message: 'Name is required' });
    }

    if (!playbook.steps?.length) {
      errors.push({ field: 'steps', message: 'At least one step is required' });
    }

    if (!playbook.triggerType) {
      errors.push({ field: 'triggerType', message: 'Trigger type is required' });
    }

    return errors;
  }, []);

  // Handle save operation
  const handleSave = useCallback(async (playbook: Playbook) => {
    try {
      setIsSaving(true);
      trackEvent(ANALYTICS_EVENTS.PLAYBOOK_SAVE_ATTEMPT, { playbookId: playbook.id });

      // Validate playbook
      const errors = validatePlaybook(playbook);
      if (errors.length > 0) {
        setValidationErrors(errors);
        trackEvent(ANALYTICS_EVENTS.PLAYBOOK_VALIDATION_ERROR, {
          playbookId: playbook.id,
          errors: errors.map(e => e.message)
        });
        showNotification({
          title: 'Validation Error',
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          type: 'error',
          duration: NOTIFICATION_DURATION
        });
        return;
      }

      // Save playbook
      await updatePlaybook(playbook);
      
      setHasUnsavedChanges(false);
      trackEvent(ANALYTICS_EVENTS.PLAYBOOK_SAVE_SUCCESS, { playbookId: playbook.id });
      
      showNotification({
        title: 'Success',
        message: 'Playbook saved successfully',
        type: 'success',
        duration: NOTIFICATION_DURATION
      });
    } catch (error) {
      console.error('Error saving playbook:', error);
      trackEvent(ANALYTICS_EVENTS.PLAYBOOK_SAVE_ERROR, {
        playbookId: playbook.id,
        error: error.message
      });
      
      showNotification({
        title: 'Error',
        message: ERROR_MESSAGES.SAVE_ERROR,
        type: 'error',
        duration: NOTIFICATION_DURATION
      });
    } finally {
      setIsSaving(false);
    }
  }, [updatePlaybook, validatePlaybook, showNotification, trackEvent]);

  // Handle playbook changes
  const handlePlaybookChange = useCallback((updatedPlaybook: Playbook) => {
    if (activePlaybook) {
      // Add current state to undo stack
      undoStackRef.current = [
        activePlaybook,
        ...undoStackRef.current.slice(0, MAX_UNDO_STEPS - 1)
      ];
      redoStackRef.current = [];
    }
    setHasUnsavedChanges(true);
  }, [activePlaybook]);

  // Handle undo/redo
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length > 0) {
      const [prevPlaybook, ...remainingUndo] = undoStackRef.current;
      undoStackRef.current = remainingUndo;
      if (activePlaybook) {
        redoStackRef.current = [activePlaybook, ...redoStackRef.current];
      }
      handlePlaybookChange(prevPlaybook);
    }
  }, [activePlaybook, handlePlaybookChange]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length > 0) {
      const [nextPlaybook, ...remainingRedo] = redoStackRef.current;
      redoStackRef.current = remainingRedo;
      if (activePlaybook) {
        undoStackRef.current = [activePlaybook, ...undoStackRef.current];
      }
      handlePlaybookChange(nextPlaybook);
    }
  }, [activePlaybook, handlePlaybookChange]);

  // Prevent accidental navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (loading) {
    return (
      <DashboardLayout title="Loading Playbook...">
        <BlitzyUI.LoadingSpinner size="large" />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="Error">
        <BlitzyUI.Alert
          type="error"
          title="Error Loading Playbook"
          message={ERROR_MESSAGES.LOAD_ERROR}
        />
      </DashboardLayout>
    );
  }

  if (!activePlaybook) {
    return (
      <DashboardLayout title="Not Found">
        <BlitzyUI.Alert
          type="error"
          title="Playbook Not Found"
          message={ERROR_MESSAGES.NOT_FOUND}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={`Edit Playbook: ${activePlaybook.name}`}
      subtitle="Configure playbook steps and automation rules"
    >
      <ErrorBoundary>
        <PlaybookBuilder
          initialPlaybook={activePlaybook}
          onSave={handleSave}
          onChange={handlePlaybookChange}
          validationErrors={validationErrors}
          isSaving={isSaving}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStackRef.current.length > 0}
          canRedo={redoStackRef.current.length > 0}
        />
      </ErrorBoundary>
    </DashboardLayout>
  );
};

export default EditPlaybook;