import React, { useState, useCallback, useEffect, useRef } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { Toolbar, Divider, Tooltip, ConfirmDialog } from '@blitzy/premium-ui'; // ^2.0.0
import Button from '../common/Button';
import { Playbook, PlaybookStatus } from '../../types/playbook';
import { useTheme } from '../../hooks/useTheme';

// Constants
const BUTTON_SPACING = 8;
const LOADING_TIMEOUT = 30000;
const ERROR_MESSAGES = {
  SAVE_FAILED: 'Failed to save playbook. Please try again.',
  ACTIVATE_FAILED: 'Failed to activate playbook. Please check configuration.',
  ARCHIVE_FAILED: 'Failed to archive playbook. Please try again.',
};

interface PlaybookToolbarProps {
  playbook: Playbook;
  onSave: (playbook: Playbook) => Promise<void>;
  onActivate: (playbook: Playbook) => Promise<void>;
  onArchive?: (playbook: Playbook) => Promise<void>;
  className?: string;
  disabled?: boolean;
  onError?: (error: Error) => void;
}

const PlaybookToolbar: React.FC<PlaybookToolbarProps> = ({
  playbook,
  onSave,
  onActivate,
  onArchive,
  className,
  disabled = false,
  onError,
}) => {
  const { theme } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSave = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    if (disabled || isSaving) return;

    setIsSaving(true);
    timeoutRef.current = setTimeout(() => {
      setIsSaving(false);
      onError?.(new Error('Save operation timed out'));
    }, LOADING_TIMEOUT);

    try {
      await onSave(playbook);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(ERROR_MESSAGES.SAVE_FAILED));
    } finally {
      setIsSaving(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [disabled, isSaving, onSave, playbook, onError]);

  const handleActivate = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    if (disabled || isActivating || playbook.status === PlaybookStatus.ACTIVE) return;

    setIsActivating(true);
    timeoutRef.current = setTimeout(() => {
      setIsActivating(false);
      onError?.(new Error('Activation operation timed out'));
    }, LOADING_TIMEOUT);

    try {
      await onActivate(playbook);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(ERROR_MESSAGES.ACTIVATE_FAILED));
    } finally {
      setIsActivating(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [disabled, isActivating, onActivate, playbook, onError]);

  const handleArchive = useCallback(async () => {
    if (!onArchive || disabled || isArchiving) return;

    setIsArchiving(true);
    timeoutRef.current = setTimeout(() => {
      setIsArchiving(false);
      onError?.(new Error('Archive operation timed out'));
    }, LOADING_TIMEOUT);

    try {
      await onArchive(playbook);
      setShowArchiveConfirm(false);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(ERROR_MESSAGES.ARCHIVE_FAILED));
    } finally {
      setIsArchiving(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [disabled, isArchiving, onArchive, playbook, onError]);

  const toolbarClasses = classNames(
    'playbook-toolbar',
    {
      'playbook-toolbar--disabled': disabled,
      [`playbook-toolbar--${playbook.status.toLowerCase()}`]: true,
    },
    className
  );

  return (
    <>
      <Toolbar 
        className={toolbarClasses}
        aria-label="Playbook actions"
        style={{ gap: BUTTON_SPACING }}
      >
        <Tooltip content="Save changes" placement="top">
          <Button
            variant="primary"
            size="medium"
            loading={isSaving}
            disabled={disabled}
            onClick={handleSave}
            aria-label="Save playbook"
          >
            Save
          </Button>
        </Tooltip>

        <Divider orientation="vertical" />

        <Tooltip 
          content={playbook.status === PlaybookStatus.ACTIVE ? 'Playbook is already active' : 'Activate playbook'}
          placement="top"
        >
          <Button
            variant="secondary"
            size="medium"
            loading={isActivating}
            disabled={disabled || playbook.status === PlaybookStatus.ACTIVE}
            onClick={handleActivate}
            aria-label="Activate playbook"
          >
            Activate
          </Button>
        </Tooltip>

        {onArchive && (
          <>
            <Divider orientation="vertical" />
            <Tooltip content="Archive playbook" placement="top">
              <Button
                variant="tertiary"
                size="medium"
                loading={isArchiving}
                disabled={disabled || playbook.status === PlaybookStatus.ARCHIVED}
                onClick={() => setShowArchiveConfirm(true)}
                aria-label="Archive playbook"
              >
                Archive
              </Button>
            </Tooltip>
          </>
        )}
      </Toolbar>

      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive Playbook"
        message="Are you sure you want to archive this playbook? This action cannot be undone."
        confirmLabel="Archive"
        cancelLabel="Cancel"
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveConfirm(false)}
        confirmVariant="danger"
        loading={isArchiving}
      />
    </>
  );
};

export default PlaybookToolbar;