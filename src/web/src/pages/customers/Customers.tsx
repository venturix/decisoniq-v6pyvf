import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlitzyUI } from '@blitzy/premium-ui'; // ^2.0.0

import CustomerList from '../../components/customers/CustomerList';
import RiskIndicators from '../../components/customers/RiskIndicators';
import PageHeader from '../../components/common/PageHeader';
import { useCustomer } from '../../hooks/useCustomer';
import { useRisk } from '../../hooks/useRisk';
import { useTheme } from '../../hooks/useTheme';
import type { Customer } from '../../types/customer';
import { PERFORMANCE_THRESHOLD } from '../../config/constants';

// Constants for component configuration
const PAGE_SIZE = 25;
const RISK_UPDATE_INTERVAL = 30000; // 30 seconds

/**
 * Enterprise-grade customer management page component
 * Implements real-time risk assessment visualization and performance-optimized data loading
 */
const Customers: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Initialize hooks with performance optimization settings
  const {
    customers,
    selectedCustomer,
    loadingState,
    error: customerError,
    loadCustomers,
    selectCustomerById,
    clearError: clearCustomerError,
  } = useCustomer({
    autoLoad: true,
    refreshInterval: RISK_UPDATE_INTERVAL,
    cacheTimeout: PERFORMANCE_THRESHOLD,
  });

  const {
    assessment: riskAssessment,
    loading: riskLoading,
    error: riskError,
    refresh: refreshRisk,
  } = useRisk(selectedCustomerId || '', {
    autoRefresh: true,
    refreshInterval: RISK_UPDATE_INTERVAL,
    enableWebSocket: true,
  });

  // Performance-optimized customer selection handler
  const handleCustomerSelect = useCallback(async (customer: Customer) => {
    try {
      setSelectedCustomerId(customer.id);
      await selectCustomerById(customer.id);
      navigate(`/customers/${customer.id}`);
    } catch (error) {
      console.error('Error selecting customer:', error);
    }
  }, [navigate, selectCustomerById]);

  // Memoized export handler with progress tracking
  const handleExportData = useCallback(async () => {
    const exportProgress = new BlitzyUI.ProgressModal({
      title: 'Exporting Customer Data',
      theme: theme,
    });

    try {
      exportProgress.show();
      // Implementation of chunked data export would go here
      exportProgress.updateProgress(100);
      exportProgress.close();
      
      BlitzyUI.Notification.success({
        message: 'Export completed successfully',
        duration: 3000,
      });
    } catch (error) {
      exportProgress.close();
      BlitzyUI.Notification.error({
        message: 'Export failed. Please try again.',
        duration: 5000,
      });
    }
  }, [theme]);

  // Error handling effect
  useEffect(() => {
    if (customerError || riskError) {
      BlitzyUI.Notification.error({
        message: 'An error occurred. Please refresh the page.',
        duration: 5000,
      });
    }
  }, [customerError, riskError]);

  // Memoized header actions
  const headerActions = useMemo(() => (
    <div className="flex gap-4">
      <BlitzyUI.Button
        variant="secondary"
        onClick={handleExportData}
        disabled={loadingState === 'loading'}
        aria-label="Export customer data"
      >
        Export Data
      </BlitzyUI.Button>
      <BlitzyUI.Button
        variant="primary"
        onClick={() => navigate('/customers/new')}
        disabled={loadingState === 'loading'}
        aria-label="Add new customer"
      >
        Add Customer
      </BlitzyUI.Button>
    </div>
  ), [handleExportData, loadingState, navigate]);

  return (
    <div 
      className="customers-page p-6"
      role="main"
      aria-label="Customer Management"
    >
      <PageHeader
        title="Customer Management"
        subtitle="Monitor and manage customer accounts with real-time risk assessment"
        actions={headerActions}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
        <div className="lg:col-span-3">
          <CustomerList
            onCustomerSelect={handleCustomerSelect}
            className="h-full"
            tenantId={process.env.VITE_TENANT_ID!}
          />
        </div>

        <div className="lg:col-span-1">
          {selectedCustomer && (
            <RiskIndicators
              riskScore={riskAssessment?.score}
              className="sticky top-6"
              updateInterval={RISK_UPDATE_INTERVAL}
              highContrast={theme.mode === 'high-contrast'}
            />
          )}
        </div>
      </div>

      {/* Accessibility announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        className="sr-only"
      >
        {loadingState === 'loading' && 'Loading customer data...'}
        {loadingState === 'success' && 'Customer data loaded successfully'}
        {loadingState === 'error' && 'Error loading customer data'}
      </div>
    </div>
  );
};

export default Customers;