import { format, isValid, parseISO, differenceInDays, addDays } from 'date-fns'; // v2.30.0

/**
 * Union type representing acceptable date input values
 */
export type DateValue = Date | string;

/**
 * Interface for date formatting configuration options
 */
export interface DateFormatOptions {
  formatString: string;
  locale?: string;
}

/**
 * Cache for memoizing frequently used date format results
 */
const formatCache = new Map<string, string>();
const CACHE_MAX_SIZE = 1000;

/**
 * Validates if a given value is a valid date
 * @param date - Date value to validate
 * @returns boolean indicating if date is valid
 */
export function isValidDate(date: DateValue): boolean {
  try {
    if (!date) return false;
    
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    // Check if date is within reasonable bounds (1900-2100)
    const year = dateObj.getFullYear();
    if (year < 1900 || year > 2100) return false;
    
    // Validate using date-fns
    return isValid(dateObj);
  } catch (error) {
    console.error('Date validation error:', error);
    return false;
  }
}

/**
 * Safely parses a date string into a Date object
 * @param dateString - ISO date string to parse
 * @returns Parsed Date object or null if invalid
 */
export function parseDate(dateString: string): Date | null {
  try {
    if (!dateString || typeof dateString !== 'string') return null;
    
    // Sanitize input
    const sanitizedDate = dateString.trim();
    
    // Parse ISO date
    const parsedDate = parseISO(sanitizedDate);
    
    // Validate parsed result
    if (!isValid(parsedDate)) return null;
    
    return parsedDate;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
}

/**
 * Formats a date according to specified format string and locale
 * @param date - Date to format
 * @param options - Formatting options
 * @returns Formatted date string or empty string if invalid
 */
export function formatDate(date: DateValue, options: DateFormatOptions): string {
  try {
    if (!isValidDate(date)) return '';
    
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const cacheKey = `${dateObj.getTime()}-${options.formatString}-${options.locale || 'default'}`;
    
    // Check cache first
    if (formatCache.has(cacheKey)) {
      return formatCache.get(cacheKey)!;
    }
    
    // Format date
    const result = format(dateObj, options.formatString);
    
    // Cache result if cache isn't too large
    if (formatCache.size < CACHE_MAX_SIZE) {
      formatCache.set(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
}

/**
 * Calculates the absolute difference between two dates in days
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of days between dates or 0 if invalid
 */
export function calculateDateDifference(startDate: DateValue, endDate: DateValue): number {
  try {
    // Parse dates if they're strings
    const start = typeof startDate === 'string' ? parseDate(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseDate(endDate) : endDate;
    
    // Validate dates
    if (!start || !end || !isValidDate(start) || !isValidDate(end)) {
      return 0;
    }
    
    // Calculate difference
    return Math.abs(differenceInDays(end, start));
  } catch (error) {
    console.error('Date difference calculation error:', error);
    return 0;
  }
}

/**
 * Clears the format cache
 * @internal
 */
export function clearFormatCache(): void {
  formatCache.clear();
}

// Additional utility functions for internal use
/**
 * @internal
 * Normalizes timezone offset for consistent date handling
 */
function normalizeTimezone(date: Date): Date {
  const offset = date.getTimezoneOffset();
  return addDays(date, offset / (24 * 60));
}