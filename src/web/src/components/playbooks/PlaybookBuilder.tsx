import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0

import PlaybookNode from './PlaybookNode';
import PlaybookToolbar from './PlaybookToolbar';
import PlaybookCanvas from './PlaybookCanvas';
import { usePlaybook } from '../../hooks/usePlaybook';
import { useTheme } from '../../hooks/useTheme';
import type { Playbook, PlaybookStep } from '../../types/playbook';

// Constants for configuration and validation
const AUTO_SAVE_DELAY = 2000;
const MAX_STEPS = 50;
const MIN_STEPS = 2;
const VALIDATION_SCHEMA_VERSION = '1.0.0';
const ACCESSIBILITY_ANNOUNCER_ID = 'playbook-builder-announcer';

interface PlaybookBuilderProps {
  initialPlaybook?: Playbook;
  onSave?: (playbook: Playbook) => Promise<void>;
  className?: string;
  readOnly?: boolean;
  autoSave?: boolean;
  validationMode?: 'strict' | 'loose';
  accessibilityMode?: 'standard' | 'enhanced';
}

/**
 * Enterprise-grade playbook builder component with accessibility support
 * Implements WCAG 2.1 Level AA compliance and real-time validation
 */
const PlaybookBuilder: React.FC<PlaybookBuilderProps> = ({
  initialPlaybook,
  onSave,
  className,
  readOnly = false,
  autoSave = true,
  validationMode = 'strict',
  accessibilityMode = 'enhanced'
}) => {
  const { theme } = useTheme();
  const {
    playbooks,
    activePlaybook,
    createPlaybook,
    updatePlaybook,
    executePlaybook
  } = usePlaybook();

  // Component state
  const [currentPlaybook, setCurrentPlaybook] = useState<Playbook | null>(initialPlaybook || null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const announcerRef = useRef<HTMLDivElement>(null);

  // Memoized validation schema
  const validationSchema = useMemo(() => ({
    version: VALIDATION_SCHEMA_VERSION,
    rules: {
      minSteps: MIN_STEPS,
      maxSteps: MAX_STEPS,
      requireTrigger: validationMode === 'strict',
      requireDescription: validationMode === 'strict'
    }
  }), [validationMode]);

  /**
   * Validates playbook configuration against schema
   */
  const validatePlaybook = useCallback((playbook: Playbook): string[] => {
    const errors: string[] = [];

    if (!playbook.steps || playbook.steps.length < validationSchema.rules.minSteps) {
      errors.push(`Playbook must have at least ${validationSchema.rules.minSteps} steps`);
    }

    if (playbook.steps && playbook.steps.length > validationSchema.rules.maxSteps) {
      errors.push(`Playbook cannot have more than ${validationSchema.rules.maxSteps} steps`);
    }

    if (validationSchema.rules.requireTrigger && !playbook.triggerType) {
      errors.push('Playbook must have a trigger condition');
    }

    if (validationSchema.rules.requireDescription && !playbook.description) {
      errors.push('Playbook must have a description');
    }

    // Validate step connections
    const stepIds = new Set(playbook.steps.map(step => step.stepId));
    playbook.steps.forEach(step => {
      if (step.nextStep && !stepIds.has(step.nextStep)) {
        errors.push(`Invalid connection from step ${step.stepId}`);
      }
    });

    return errors;
  }, [validationSchema]);

  /**
   * Handles saving playbook with validation
   */
  const handleSave = useCallback(async (playbook: Playbook) => {
    try {
      setIsSaving(true);
      const errors = validatePlaybook(playbook);
      setValidationErrors(errors);

      if (errors.length > 0) {
        announceValidationErrors(errors);
        return;
      }

      await updatePlaybook(playbook);
      onSave?.(playbook);

      announceMessage('Playbook saved successfully');
    } catch (error) {
      console.error('Error saving playbook:', error);
      setValidationErrors(['Failed to save playbook']);
      announceMessage('Error saving playbook');
    } finally {
      setIsSaving(false);
    }
  }, [updatePlaybook, onSave, validatePlaybook]);

  /**
   * Handles activating playbook with pre-activation validation
   */
  const handleActivate = useCallback(async (playbook: Playbook) => {
    try {
      const errors = validatePlaybook(playbook);
      if (errors.length > 0) {
        setValidationErrors(errors);
        announceValidationErrors(errors);
        return;
      }

      await executePlaybook(playbook.id, 'SYSTEM');
      announceMessage('Playbook activated successfully');
    } catch (error) {
      console.error('Error activating playbook:', error);
      setValidationErrors(['Failed to activate playbook']);
      announceMessage('Error activating playbook');
    }
  }, [executePlaybook, validatePlaybook]);

  /**
   * Announces messages for screen readers
   */
  const announceMessage = useCallback((message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message;
    }
  }, []);

  /**
   * Announces validation errors for screen readers
   */
  const announceValidationErrors = useCallback((errors: string[]) => {
    const message = `Validation errors: ${errors.join('. ')}`;
    announceMessage(message);
  }, [announceMessage]);

  // Auto-save handler
  useEffect(() => {
    if (autoSave && currentPlaybook && !readOnly && !isSaving) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(currentPlaybook);
      }, AUTO_SAVE_DELAY);
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [currentPlaybook, autoSave, readOnly, isSaving, handleSave]);

  const containerClasses = classNames(
    'playbook-builder',
    {
      'playbook-builder--readonly': readOnly,
      'playbook-builder--editing': isEditing,
      'playbook-builder--saving': isSaving,
      'playbook-builder--enhanced': accessibilityMode === 'enhanced',
      [`playbook-builder--theme-${theme.mode}`]: true,
    },
    className
  );

  return (
    <div 
      className={containerClasses}
      role="application"
      aria-label="Playbook Builder"
    >
      <div
        ref={announcerRef}
        id={ACCESSIBILITY_ANNOUNCER_ID}
        className="sr-only"
        role="status"
        aria-live="polite"
      />

      <PlaybookToolbar
        playbook={currentPlaybook}
        onSave={handleSave}
        onActivate={handleActivate}
        disabled={readOnly || isSaving}
      />

      <PlaybookCanvas
        playbook={currentPlaybook}
        onChange={setCurrentPlaybook}
        onSave={handleSave}
        onActivate={handleActivate}
        readOnly={readOnly}
        theme={theme.mode}
      />

      {validationErrors.length > 0 && (
        <BlitzyUI.Alert
          variant="error"
          title="Validation Errors"
          className="playbook-builder__validation"
          role="alert"
        >
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </BlitzyUI.Alert>
      )}
    </div>
  );
};

export default PlaybookBuilder;