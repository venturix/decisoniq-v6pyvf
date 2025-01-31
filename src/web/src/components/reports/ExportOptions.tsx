import React, { useCallback, useMemo, useState } from 'react'; // ^18.0.0
import * as yup from 'yup'; // ^1.0.0
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { Form } from '../common/Form';
import { ValidationError } from '../../utils/validation';

// Export format configurations with size limits and metadata
const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF Document', icon: 'PdfIcon', maxSize: 50000000 },
  { value: 'csv', label: 'CSV File', icon: 'CsvIcon', maxSize: 100000000 },
  { value: 'excel', label: 'Excel Spreadsheet', icon: 'ExcelIcon', maxSize: 100000000 },
  { value: 'json', label: 'JSON Data', icon: 'JsonIcon', maxSize: 100000000 }
] as const;

// Date range options for export filtering
const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time', description: 'Export complete history' },
  { value: '30days', label: 'Last 30 Days', description: 'Export last 30 days of data' },
  { value: '90days', label: 'Last 90 Days', description: 'Export last 90 days of data' },
  { value: 'custom', label: 'Custom Range', description: 'Select custom date range' }
] as const;

// Type definitions for component props and configurations
export interface ExportOptionsProps {
  onExport: (format: string, options: ExportConfig) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  maxFileSize?: number;
  onError?: (error: ValidationError) => void;
}

export interface ExportConfig {
  format: typeof EXPORT_FORMATS[number]['value'];
  includeMetadata: boolean;
  dateRange: typeof DATE_RANGE_OPTIONS[number]['value'];
  customDateRange?: { start: Date; end: Date };
  compression: boolean;
}

// Validation schema for export configuration
const exportConfigSchema = yup.object().shape({
  format: yup.string().oneOf(EXPORT_FORMATS.map(f => f.value)).required('Export format is required'),
  includeMetadata: yup.boolean().default(true),
  dateRange: yup.string().oneOf(DATE_RANGE_OPTIONS.map(d => d.value)).required('Date range is required'),
  customDateRange: yup.object().when('dateRange', {
    is: 'custom',
    then: yup.object({
      start: yup.date().required('Start date is required'),
      end: yup.date().required('End date is required').min(
        yup.ref('start'),
        'End date must be after start date'
      )
    })
  }),
  compression: yup.boolean().default(false)
});

export const ExportOptions: React.FC<ExportOptionsProps> = React.memo(({
  onExport,
  loading = false,
  disabled = false,
  maxFileSize = 100000000,
  onError
}) => {
  const [exportFormat, setExportFormat] = useState<string>(EXPORT_FORMATS[0].value);
  const [dateRange, setDateRange] = useState<string>(DATE_RANGE_OPTIONS[0].value);

  // Validate export configuration before processing
  const validateExportConfig = useCallback(async (config: ExportConfig): Promise<boolean> => {
    try {
      await exportConfigSchema.validate(config, { abortEarly: false });
      
      // Check file size constraints
      const selectedFormat = EXPORT_FORMATS.find(f => f.value === config.format);
      if (selectedFormat && maxFileSize && selectedFormat.maxSize > maxFileSize) {
        throw new ValidationError(
          'Selected format exceeds maximum file size limit',
          'format',
          'MAX_SIZE_EXCEEDED'
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        onError?.(error);
      } else if (error instanceof yup.ValidationError) {
        onError?.(new ValidationError(
          error.message,
          error.path || 'format',
          'VALIDATION_ERROR'
        ));
      }
      return false;
    }
  });

  // Handle export initiation with validation
  const handleExport = useCallback(async (values: Record<string, any>) => {
    const config: ExportConfig = {
      format: values.format,
      includeMetadata: values.includeMetadata ?? true,
      dateRange: values.dateRange,
      customDateRange: values.customDateRange,
      compression: values.compression ?? false
    };

    if (await validateExportConfig(config)) {
      try {
        await onExport(config.format, config);
      } catch (error) {
        onError?.(new ValidationError(
          'Export failed. Please try again.',
          'export',
          'EXPORT_FAILED'
        ));
      }
    }
  }, [onExport, validateExportConfig, onError]);

  // Generate format options with accessibility enhancements
  const formatOptions = useMemo(() => 
    EXPORT_FORMATS.map(format => ({
      value: format.value,
      label: `${format.label} (Max size: ${Math.round(format.maxSize / 1024 / 1024)}MB)`
    })),
    []
  );

  return (
    <Form
      onSubmit={handleExport}
      initialValues={{
        format: exportFormat,
        dateRange,
        includeMetadata: true,
        compression: false
      }}
      validationSchema={exportConfigSchema}
      className="blitzy-export-options"
    >
      <div className="space-y-4">
        <Select
          name="format"
          label="Export Format"
          value={exportFormat}
          onChange={(value) => setExportFormat(value.toString())}
          options={formatOptions}
          disabled={disabled || loading}
          required
          aria-label="Select export format"
        />

        <Select
          name="dateRange"
          label="Date Range"
          value={dateRange}
          onChange={(value) => setDateRange(value.toString())}
          options={DATE_RANGE_OPTIONS}
          disabled={disabled || loading}
          required
          aria-label="Select date range"
        />

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="includeMetadata"
              defaultChecked
              disabled={disabled || loading}
              className="form-checkbox"
              aria-label="Include metadata in export"
            />
            <span>Include Metadata</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="compression"
              disabled={disabled || loading}
              className="form-checkbox"
              aria-label="Enable file compression"
            />
            <span>Enable Compression</span>
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={disabled}
          fullWidth
          aria-label="Download Report"
        >
          Download Report
        </Button>
      </div>
    </Form>
  );
});

ExportOptions.displayName = 'ExportOptions';

export default ExportOptions;