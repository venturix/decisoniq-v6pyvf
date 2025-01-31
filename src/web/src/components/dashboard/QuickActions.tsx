import React, { useCallback, useState } from 'react'; // ^18.0.0
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import { usePermissions } from '@blitzy/permissions'; // ^1.0.0

// Internal imports
import Button from '../common/Button';
import { usePlaybook } from '../../hooks/usePlaybook';
import { useCustomer } from '../../hooks/useCustomer';
import { useAnalytics } from '../../hooks/useAnalytics';

interface QuickActionsProps {
  className?: string;
  onError?: (error: Error) => void;
  telemetryEnabled?: boolean;
}

/**
 * QuickActions component providing rapid access to common customer success operations
 * Implements role-based access control, error handling, and accessibility features
 */
const QuickActions: React.FC<QuickActionsProps> = React.memo(({
  className = '',
  onError,
  telemetryEnabled = true
}) => {
  const navigate = useNavigate();
  const { createPlaybook } = usePlaybook();
  const { selectCustomerById } = useCustomer();
  const { trackEvent } = useAnalytics();
  const { hasPermission } = usePermissions();

  // Loading states for buttons
  const [loading, setLoading] = useState({
    playbook: false,
    bulkAssign: false,
    intervention: false
  });

  /**
   * Handles playbook creation with error handling and analytics
   */
  const handleCreatePlaybook = useCallback(async () => {
    if (!hasPermission('canManagePlaybooks')) {
      onError?.(new Error('Insufficient permissions to create playbook'));
      return;
    }

    try {
      setLoading(prev => ({ ...prev, playbook: true }));

      if (telemetryEnabled) {
        trackEvent('quick_action_create_playbook', {
          timestamp: new Date().toISOString()
        });
      }

      navigate('/playbooks/create');
    } catch (error) {
      console.error('Error creating playbook:', error);
      onError?.(error as Error);
    } finally {
      setLoading(prev => ({ ...prev, playbook: false }));
    }
  }, [hasPermission, navigate, onError, telemetryEnabled, trackEvent]);

  /**
   * Handles bulk assignment with error handling and analytics
   */
  const handleBulkAssign = useCallback(async () => {
    if (!hasPermission('canManageCustomers')) {
      onError?.(new Error('Insufficient permissions for bulk assignment'));
      return;
    }

    try {
      setLoading(prev => ({ ...prev, bulkAssign: true }));

      if (telemetryEnabled) {
        trackEvent('quick_action_bulk_assign', {
          timestamp: new Date().toISOString()
        });
      }

      navigate('/customers/bulk-assign');
    } catch (error) {
      console.error('Error initiating bulk assign:', error);
      onError?.(error as Error);
    } finally {
      setLoading(prev => ({ ...prev, bulkAssign: false }));
    }
  }, [hasPermission, navigate, onError, telemetryEnabled, trackEvent]);

  /**
   * Handles new intervention creation with error handling and analytics
   */
  const handleNewIntervention = useCallback(async () => {
    if (!hasPermission('canExecutePlaybooks')) {
      onError?.(new Error('Insufficient permissions to create intervention'));
      return;
    }

    try {
      setLoading(prev => ({ ...prev, intervention: true }));

      if (telemetryEnabled) {
        trackEvent('quick_action_new_intervention', {
          timestamp: new Date().toISOString()
        });
      }

      navigate('/interventions/new');
    } catch (error) {
      console.error('Error creating intervention:', error);
      onError?.(error as Error);
    } finally {
      setLoading(prev => ({ ...prev, intervention: false }));
    }
  }, [hasPermission, navigate, onError, telemetryEnabled, trackEvent]);

  return (
    <div 
      className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}
      role="toolbar"
      aria-label="Quick actions"
    >
      <Button
        variant="primary"
        size="large"
        loading={loading.playbook}
        disabled={!hasPermission('canManagePlaybooks')}
        onClick={handleCreatePlaybook}
        fullWidth
        aria-label="Create new playbook"
        data-testid="create-playbook-btn"
      >
        Create Playbook
      </Button>

      <Button
        variant="primary"
        size="large"
        loading={loading.bulkAssign}
        disabled={!hasPermission('canManageCustomers')}
        onClick={handleBulkAssign}
        fullWidth
        aria-label="Bulk assign customers"
        data-testid="bulk-assign-btn"
      >
        Bulk Assign
      </Button>

      <Button
        variant="primary"
        size="large"
        loading={loading.intervention}
        disabled={!hasPermission('canExecutePlaybooks')}
        onClick={handleNewIntervention}
        fullWidth
        aria-label="Create new intervention"
        data-testid="new-intervention-btn"
      >
        New Intervention
      </Button>
    </div>
  );
});

QuickActions.displayName = 'QuickActions';

export default QuickActions;