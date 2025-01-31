import React, { useCallback, useRef, useState } from 'react'; // ^18.0.0
import { Table as BlitzyTable, Pagination } from '@blitzy/premium-ui'; // ^2.0.0
import classNames from 'classnames'; // ^2.3.0
import { useTheme } from '../../hooks/useTheme';
import { Loading } from './Loading';
import type { BlitzyThemeConfig } from '../../types/blitzy';

// Default page size options
const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

// Sort direction constants
const SORT_DIRECTIONS = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export interface TableColumn<T> {
  id: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  tooltip?: string;
  responsive?: boolean;
  ariaLabel?: string;
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  isLoading?: boolean;
  sortable?: boolean;
  pagination?: boolean;
  totalItems?: number;
  currentPage?: number;
  pageSize?: number;
  className?: string;
  ariaLabel?: string;
  ariaLabelSort?: string;
  highContrast?: boolean;
  dir?: 'ltr' | 'rtl';
  onSort?: (columnId: string, direction: typeof SORT_DIRECTIONS[keyof typeof SORT_DIRECTIONS]) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export const Table = <T extends Record<string, any>>({
  data,
  columns,
  isLoading = false,
  sortable = true,
  pagination = true,
  totalItems = 0,
  currentPage = 1,
  pageSize = DEFAULT_PAGE_SIZES[0],
  className,
  ariaLabel = 'Data table',
  ariaLabelSort = 'Click to sort',
  highContrast = false,
  dir = 'ltr',
  onSort,
  onPageChange,
  onPageSizeChange,
}: TableProps<T>): JSX.Element => {
  const { theme } = useTheme();
  const tableRef = useRef<HTMLDivElement>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<typeof SORT_DIRECTIONS[keyof typeof SORT_DIRECTIONS]>(SORT_DIRECTIONS.ASC);
  const [announcementText, setAnnouncementText] = useState<string>('');

  // Handle column sorting with keyboard support
  const handleSort = useCallback((columnId: string, event?: React.KeyboardEvent) => {
    if (!sortable) return;

    // Handle keyboard events
    if (event && !['Enter', ' '].includes(event.key)) return;
    if (event) event.preventDefault();

    const newDirection = sortColumn === columnId && sortDirection === SORT_DIRECTIONS.ASC
      ? SORT_DIRECTIONS.DESC
      : SORT_DIRECTIONS.ASC;

    setSortColumn(columnId);
    setSortDirection(newDirection);

    // Update ARIA live region
    const column = columns.find(col => col.id === columnId);
    setAnnouncementText(
      `Table sorted by ${column?.header} in ${newDirection === SORT_DIRECTIONS.ASC ? 'ascending' : 'descending'} order`
    );

    onSort?.(columnId, newDirection);
  }, [sortable, sortColumn, sortDirection, columns, onSort]);

  // Handle page changes with smooth scroll
  const handlePageChange = useCallback((page: number) => {
    if (page === currentPage) return;

    onPageChange?.(page);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    setAnnouncementText(`Navigated to page ${page}`);
  }, [currentPage, onPageChange]);

  // Generate table styles based on theme
  const getTableStyles = (theme: BlitzyThemeConfig) => ({
    '--table-bg': theme.colors.background,
    '--table-border': theme.colors.border,
    '--table-header-bg': theme.colors.surface,
    '--table-row-hover': theme.colors.hover,
    '--table-text': theme.colors.text,
    '--table-text-secondary': theme.colors.textSecondary,
    '--table-focus-ring': theme.colors.focus,
  } as React.CSSProperties);

  return (
    <div
      ref={tableRef}
      className={classNames(
        'cs-table-wrapper',
        {
          'cs-table--high-contrast': highContrast || theme.mode === 'high-contrast',
          'cs-table--rtl': dir === 'rtl',
        },
        className
      )}
      style={getTableStyles(theme)}
      dir={dir}
    >
      {/* Accessibility announcement area */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {announcementText}
      </div>

      <div className="cs-table" role="region" aria-label={ariaLabel}>
        {isLoading && (
          <Loading
            overlay
            size="lg"
            text="Loading table data..."
            testId="table-loading"
          />
        )}

        <BlitzyTable
          columns={columns.map(column => ({
            ...column,
            header: (
              <div
                role={column.sortable ? 'button' : undefined}
                tabIndex={column.sortable ? 0 : undefined}
                onClick={column.sortable ? () => handleSort(column.id) : undefined}
                onKeyDown={column.sortable ? (e) => handleSort(column.id, e) : undefined}
                aria-label={column.sortable ? `${column.header}, ${ariaLabelSort}` : undefined}
                aria-sort={sortColumn === column.id
                  ? sortDirection === SORT_DIRECTIONS.ASC ? 'ascending' : 'descending'
                  : undefined
                }
                className={classNames('cs-table__header', {
                  'cs-table__header--sortable': column.sortable,
                  'cs-table__header--sorted': sortColumn === column.id,
                })}
              >
                {column.header}
                {column.sortable && (
                  <span className="cs-table__sort-icon" aria-hidden="true">
                    {sortColumn === column.id && (
                      sortDirection === SORT_DIRECTIONS.ASC ? '↑' : '↓'
                    )}
                  </span>
                )}
              </div>
            ),
          }))}
          data={data}
          className="cs-table__content"
          aria-busy={isLoading}
        />

        {pagination && totalItems > 0 && (
          <div className="cs-table__pagination">
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              pageSizeOptions={DEFAULT_PAGE_SIZES}
              onPageChange={handlePageChange}
              onPageSizeChange={onPageSizeChange}
              aria-label="Table pagination"
              highContrast={highContrast || theme.mode === 'high-contrast'}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Table;