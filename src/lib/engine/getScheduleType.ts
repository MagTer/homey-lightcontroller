/**
 * getScheduleType - Determine if a given date is a weekday or weekend/holiday
 *
 * Uses date-holidays to detect public holidays. Returns 'weekend' for Saturday,
 * Sunday, and recognized public/bank holidays. Returns 'weekday' otherwise.
 */

import Holidays from 'date-holidays';
import type { Logger } from './EvaluationContext.js';

// Module-level cache to avoid re-constructing Holidays instances
const holidaysCache = new Map<string, Holidays>();

/**
 * Get the Holidays instance for a country code, with caching
 * Returns null if initialization fails
 */
function getHolidaysForCountry(countryCode: string, logger?: Logger): Holidays | null {
  // Check cache first
  const cached = holidaysCache.get(countryCode);
  if (cached) {
    return cached;
  }

  try {
    const hd = new Holidays(countryCode);
    holidaysCache.set(countryCode, hd);
    return hd;
  } catch (err) {
    // Log warning once via injected logger, or silently fallback
    const warningMsg = `date-holidays initialization failed for country "${countryCode}", falling back to plain weekday/weekend check`;
    logger?.(warningMsg);

    return null;
  }
}

/**
 * Check if a date is a public holiday
 * Only considers holidays of type 'public' or 'bank' as days off
 * 'observance' holidays (like flag days) do NOT count as weekend days
 */
function isPublicHoliday(hd: Holidays | null, date: Date): boolean {
  if (!hd) {
    return false;
  }

  const holidays = hd.isHoliday(date);
  if (!holidays) {
    return false;
  }

  // Handle both single holiday object and array of holidays
  const holidayArray = Array.isArray(holidays) ? holidays : [holidays];

  return holidayArray.some((h) => h.type === 'public' || h.type === 'bank');
}

/**
 * Determine schedule type for a given date and country
 *
 * @param now - Date to evaluate
 * @param countryCode - ISO country code (e.g., 'NL', 'US', 'DE')
 * @param logger - Optional logger for warnings
 * @returns 'weekday' or 'weekend' based on day of week and holidays
 */
export function getScheduleType(
  now: Date,
  countryCode: string,
  logger?: Logger
): 'weekday' | 'weekend' {
  // Weekend check (0 = Sunday, 6 = Saturday)
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'weekend';
  }

  // Empty/invalid country code: fallback to plain weekday/weekend
  if (!countryCode || countryCode.trim() === '') {
    return 'weekday';
  }

  // Try to get holidays for the country
  const hd = getHolidaysForCountry(countryCode, logger);

  // If we couldn't initialize holidays, we already know it's a weekday from day check above
  if (!hd) {
    return 'weekday';
  }

  // Check for public holidays
  if (isPublicHoliday(hd, now)) {
    return 'weekend';
  }

  return 'weekday';
}
