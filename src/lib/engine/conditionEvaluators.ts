/**
 * Condition Evaluators - Pure functions for evaluating time, solar, and lux conditions
 *
 * All evaluators share a common return shape: { triggered: boolean; eventTime?: Date }
 * The evaluation window for time/solar checks is (lastEvalTime, now] (exclusive lower, inclusive upper).
 */

import SunCalc from 'suncalc';
import type {
  Condition,
  TimeCondition,
  SolarCondition,
  LuxCondition
} from '../config/Config.js';
import type { EvaluationContext } from './EvaluationContext.js';

/**
 * Result shape for all condition evaluators
 */
export interface EvalResult {
  /** Whether the condition triggered within the evaluation window */
  triggered: boolean;
  /** The specific time when the condition triggered (if triggered) */
  eventTime?: Date;
}

/**
 * Creates a Date from an HH:MM string for a specific base date (in UTC timezone)
 * Uses setUTCHours to ensure consistent UTC behavior
 */
function parseTimeForDate(timeStr: string, baseDate: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(baseDate);
  result.setUTCHours(hours!, minutes!, 0, 0);
  return result;
}

/**
 * Creates yesterday's date from a given date (UTC-aware)
 */
function getYesterday(date: Date): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

/**
 * Evaluates a time condition (HH:MM format) against the evaluation window.
 * Checks both today's and yesterday's candidate times.
 * Returns the earliest candidate that falls within (lastEvalTime, now].
 */
export function evaluateTime(
  cond: TimeCondition,
  lastEvalTime: Date,
  now: Date
): EvalResult {
  // Build candidate times for today and yesterday
  const todayCandidate = parseTimeForDate(cond.at, now);
  const yesterday = getYesterday(now);
  const yesterdayCandidate = parseTimeForDate(cond.at, yesterday);

  const candidates = [todayCandidate, yesterdayCandidate]
    .filter(d => d > lastEvalTime && d <= now)
    .sort((a, b) => a.getTime() - b.getTime());

  if (candidates.length > 0) {
    return { triggered: true, eventTime: candidates[0] };
  }

  return { triggered: false };
}



/**
 * Checks if a date is valid (not Invalid Date)
 */
function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

/**
 * Evaluates a solar condition against the evaluation window.
 * Calls SunCalc.getTimes for today and yesterday, picks the field matching cond.event,
 * applies the offset in minutes, and returns the earliest result in the window.
 * If SunCalc returns an invalid Date (e.g., polar regions), returns triggered: false.
 */
export function evaluateSolar(
  cond: SolarCondition,
  lastEvalTime: Date,
  now: Date,
  lat: number,
  lon: number
): EvalResult {
  // Get solar times for today and yesterday
  const todayTimes = SunCalc.getTimes(now, lat, lon);
  const yesterday = getYesterday(now);
  const yesterdayTimes = SunCalc.getTimes(yesterday, lat, lon);

  const offsetMs = cond.offsetMinutes * 60_000;

  // Extract the specific event times
  const todayEvent = todayTimes[cond.event];
  const yesterdayEvent = yesterdayTimes[cond.event];

  const candidates: Date[] = [];

  // Add valid candidates with offset applied
  if (todayEvent && isValidDate(todayEvent)) {
    const adjusted = new Date(todayEvent.getTime() + offsetMs);
    if (adjusted > lastEvalTime && adjusted <= now) {
      candidates.push(adjusted);
    }
  }

  if (yesterdayEvent && isValidDate(yesterdayEvent)) {
    const adjusted = new Date(yesterdayEvent.getTime() + offsetMs);
    if (adjusted > lastEvalTime && adjusted <= now) {
      candidates.push(adjusted);
    }
  }

  if (candidates.length > 0) {
    // Return the earliest candidate
    candidates.sort((a, b) => a.getTime() - b.getTime());
    return { triggered: true, eventTime: candidates[0] };
  }

  return { triggered: false };
}

/**
 * Evaluates a lux (ambient light) condition.
 * When lux is null, returns triggered: false.
 * Otherwise applies the operator ('lt' | 'gt') against the threshold value.
 * Returns eventTime: now on a hit.
 */
export function evaluateLux(
  cond: LuxCondition,
  lux: number | null,
  now: Date
): EvalResult {
  if (lux === null) {
    return { triggered: false };
  }

  const triggered = cond.operator === 'lt'
    ? lux < cond.value
    : lux > cond.value;

  if (triggered) {
    return { triggered: true, eventTime: now };
  }

  return { triggered: false };
}

/**
 * Dispatcher that routes a condition to its appropriate evaluator.
 * Switches on cond.type and extracts the required values from the context.
 */
export function evaluateCondition(
  cond: Condition,
  ctx: EvaluationContext,
  lastEvalTime: Date
): EvalResult {
  switch (cond.type) {
    case 'time':
      return evaluateTime(cond, lastEvalTime, ctx.now);

    case 'solar':
      return evaluateSolar(cond, lastEvalTime, ctx.now, ctx.latitude, ctx.longitude);

    case 'lux':
      return evaluateLux(cond, ctx.lux, ctx.now);

    default:
      // TypeScript exhaustiveness check - this should never happen
      const _exhaustive: never = cond;
      void _exhaustive;
      return { triggered: false };
  }
}
