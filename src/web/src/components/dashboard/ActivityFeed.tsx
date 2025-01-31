import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'; // ^18.0.0
import { format } from 'date-fns'; // ^2.30.0
import classNames from 'classnames'; // ^2.3.0
import { FixedSizeList as VirtualList } from 'react-window'; // ^1.8.9
import Card from '../common/Card';
import { useCustomer } from '../../hooks/useCustomer';
import type { Customer } from '../../types/customer';

// Activity feed component props with enterprise features
interface ActivityFeedProps {
  maxItems?: number;
  refreshInterval?: number;
  className?: string;
  highContrast?: boolean;
  errorRetryCount?: number;
  customClassNames?: Record<string, string>;
}

// Activity item structure with comprehensive metadata
interface ActivityItem {
  id: string;
  type: 'interaction' | 'risk_alert' | 'playbook' | 'system';
  customerId: string;
  description: string;
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
  riskCorrelation?: string;
}

// Activity item row renderer for virtualized list
interface ActivityRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    activities: ActivityItem[];
    customers: Customer[];
    onRetry: () => void;
  };
}

const ACTIVITY_ROW_HEIGHT = 72;
const DEFAULT_MAX_ITEMS = 50;
const DEFAULT_REFRESH_INTERVAL = 30000;
const ERROR_RETRY_DELAY = 3000;

// Activity row component with memoization for performance
const ActivityRow: React.FC<ActivityRowProps> = React.memo(({ index, style, data }) => {
  const { activities, customers } = data;
  const activity = activities[index];
  const customer = customers.find(c => c.id === activity.customerId);

  const severityClasses = {
    low: 'bg-success-100 text-success-700',
    medium: 'bg-warning-100 text-warning-700',
    high: 'bg-error-100 text-error-700',
    critical: 'bg-error-200 text-error-800'
  };

  return (
    <div 
      style={style}
      className="px-4 py-3 border-b border-border hover:bg-surface-hover transition-colors"
      role="listitem"
      aria-label={`Activity for ${customer?.name || 'Unknown Customer'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <span className="font-medium text-text">
            {customer?.name || 'Unknown Customer'}
          </span>
          <p className="text-sm text-text-secondary mt-1">
            {activity.description}
          </p>
        </div>
        <div className="flex flex-col items-end ml-4">
          <span className="text-sm text-text-secondary">
            {format(activity.timestamp, 'MMM d, h:mm a')}
          </span>
          {activity.severity && (
            <span className={classNames(
              'text-xs px-2 py-1 rounded-full mt-1',
              severityClasses[activity.severity]
            )}>
              {activity.severity.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

ActivityRow.displayName = 'ActivityRow';

// Main ActivityFeed component with enterprise features
export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  maxItems = DEFAULT_MAX_ITEMS,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  className,
  highContrast = false,
  errorRetryCount = 3,
  customClassNames = {}
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const retryCount = useRef(0);
  const listRef = useRef<VirtualList>(null);

  const { customers, loadCustomers } = useCustomer({
    autoLoad: true,
    refreshInterval
  });

  // Fetch activities with error handling and retries
  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      // Simulated API call - replace with actual implementation
      const response = await fetch(`/api/activities?limit=${maxItems}`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      
      const data = await response.json();
      setActivities(data.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      })));
      
      setError(null);
      retryCount.current = 0;
    } catch (err) {
      if (retryCount.current < errorRetryCount) {
        retryCount.current++;
        setTimeout(fetchActivities, ERROR_RETRY_DELAY);
      } else {
        setError(err as Error);
      }
    } finally {
      setLoading(false);
    }
  }, [maxItems, errorRetryCount]);

  // Setup refresh interval
  useEffect(() => {
    fetchActivities();
    const intervalId = setInterval(fetchActivities, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchActivities, refreshInterval]);

  // Memoized list data
  const listData = useMemo(() => ({
    activities,
    customers,
    onRetry: fetchActivities
  }), [activities, customers, fetchActivities]);

  // Calculate list height based on available items
  const listHeight = useMemo(() => 
    Math.min(activities.length * ACTIVITY_ROW_HEIGHT, 400),
    [activities.length]
  );

  return (
    <Card
      variant="default"
      className={classNames('activity-feed', className, customClassNames.root)}
      highContrast={highContrast}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text">
          Recent Activities
        </h2>
        {error && (
          <button
            onClick={fetchActivities}
            className="text-sm text-primary hover:text-primary-dark"
            aria-label="Retry loading activities"
          >
            Retry
          </button>
        )}
      </div>

      {loading && activities.length === 0 ? (
        <div className="flex items-center justify-center h-48" role="status">
          <div className="animate-pulse space-y-4 w-full">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-16 bg-surface-hover rounded"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      ) : error && activities.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-48 text-text-secondary"
          role="alert"
        >
          <p className="mb-2">Failed to load activities</p>
          <button
            onClick={fetchActivities}
            className="text-primary hover:text-primary-dark"
          >
            Try Again
          </button>
        </div>
      ) : (
        <VirtualList
          ref={listRef}
          height={listHeight}
          width="100%"
          itemCount={activities.length}
          itemSize={ACTIVITY_ROW_HEIGHT}
          itemData={listData}
          className="focus:outline-none"
          role="list"
          aria-label="Activity feed"
        >
          {ActivityRow}
        </VirtualList>
      )}
    </Card>
  );
};

export default ActivityFeed;