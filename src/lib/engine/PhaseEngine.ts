/**
 * PhaseEngine - Main phase resolution engine with windowed fast-forward
 *
 * Evaluates phase transitions based on AppConfig and EvaluationContext.
 * Supports weekday/weekend/holiday schedules, time/solar/lux conditions,
 * and windowed fast-forward catchup for reboots.
 */

import type { Phase, AppConfig, PhaseSchedule, Condition } from '../config/Config.js';
import type { EvaluationContext } from './EvaluationContext.js';
import { evaluateCondition, type EvalResult } from './conditionEvaluators.js';
import { getScheduleType } from './getScheduleType.js';

/**
 * Standard phase order - transitions wrap from EVENING back to NIGHT
 */
export const PHASE_ORDER: Phase[] = ['NIGHT', 'MORNING', 'DAY', 'EVENING'];

/**
 * Maximum allowed iterations to prevent infinite loops in misconfigured schedules
 */
const MAX_ITERATIONS = 4;

/**
 * Evaluation window: maximum lookback for fast-forward catchup after reboots
 */
const MAX_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Record of a phase transition for diagnostic and logging purposes
 */
export interface TransitionRecord {
  /** Previous phase */
  from: Phase;
  /** New phase */
  to: Phase;
  /** Reason for the transition */
  reason: 'time' | 'solar' | 'lux';
  /** Exact time when the transition occurred */
  eventTime: Date;
}

/**
 * Result from phase evaluation
 */
export interface EngineResult {
  /** Current phase after evaluation */
  phase: Phase;
  /** Time of this evaluation (for next tick's window calculation) */
  lastEvalTime: Date;
  /** All transitions that occurred in this evaluation window */
  transitions: TransitionRecord[];
  /** Set when iteration cap is reached, indicating potential misconfiguration */
  cappedAt?: number;
}

/**
 * Gets the index of a phase in PHASE_ORDER
 */
function getPhaseIndex(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

/**
 * Gets the next phase in the cycle (wraps from EVENING to NIGHT)
 */
function getNextPhase(currentPhase: Phase): Phase {
  const currentIdx = getPhaseIndex(currentPhase);
  const nextIdx = (currentIdx + 1) % PHASE_ORDER.length;
  return PHASE_ORDER[nextIdx];
}

/**
 * Evaluates a single phase's conditions to see if it should transition.
 * Returns the earliest triggering condition (OR semantics - first match wins).
 */
function evaluatePhaseConditions(
  schedule: PhaseSchedule,
  ctx: EvaluationContext,
  evalTime: Date
): EvalResult & { reason?: 'time' | 'solar' | 'lux' } {
  let earliestResult: (EvalResult & { reason?: 'time' | 'solar' | 'lux' }) | null = null;

  for (const condition of schedule.conditions) {
    const result = evaluateCondition(condition, ctx, evalTime);

    if (result.triggered && result.eventTime) {
      // Keep the earliest triggering condition
      if (!earliestResult || result.eventTime < earliestResult.eventTime!) {
        earliestResult = {
          ...result,
          reason: condition.type
        };
      }
    }
  }

  return earliestResult ?? { triggered: false };
}

/**
 * Main phase evaluation function.
 *
 * Determines the active lighting phase from an AppConfig + EvaluationContext,
 * supporting weekday/weekend/holiday schedules, time/solar/lux conditions,
 * and windowed fast-forward catchup for reboots.
 *
 * @param currentPhase - The phase we were in at lastEvalTime
 * @param lastEvalTime - The end of the previous evaluation window
 * @param config - Application configuration with phase schedules
 * @param ctx - Evaluation context with current time, location, lux, etc.
 * @returns EngineResult with final phase, transitions, and optional cap flag
 */
export function evaluatePhase(
  currentPhase: Phase,
  lastEvalTime: Date,
  config: AppConfig,
  ctx: EvaluationContext
): EngineResult {
  const transitions: TransitionRecord[] = [];

  // Clamp the evaluation window to prevent excessive catchup after long downtimes
  const windowStart = new Date(Math.max(
    lastEvalTime.getTime(),
    ctx.now.getTime() - MAX_LOOKBACK_MS
  ));

  let evalTime = windowStart;
  let phase = currentPhase;
  let cappedAt: number | undefined;

  // Fast-forward loop: process multiple transitions if they occurred during the window
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const nextPhase = getNextPhase(phase);

    // Resolve schedule type for the current evalTime (may change if we cross midnight)
    const scheduleType = getScheduleType(
      evalTime,
      ctx.countryCode,
      ctx.logger
    );

    // Get the schedule for the next phase based on weekday/weekend
    const phaseConfig = config.phases[nextPhase];
    const schedule = scheduleType === 'weekday'
      ? phaseConfig.weekday
      : phaseConfig.weekend;

    // Evaluate conditions for this phase transition
    const result = evaluatePhaseConditions(schedule, ctx, evalTime);

    if (result.triggered && result.eventTime && result.reason) {
      // Transition occurred - record it and continue
      transitions.push({
        from: phase,
        to: nextPhase,
        reason: result.reason,
        eventTime: result.eventTime
      });

      phase = nextPhase;
      evalTime = result.eventTime; // Window shrinks - we've processed up to this point
    } else {
      // No transition triggered - we're done
      break;
    }
  }

  // Check if we hit the iteration cap
  if (transitions.length >= MAX_ITERATIONS) {
    cappedAt = MAX_ITERATIONS;
  }

  return {
    phase,
    lastEvalTime: ctx.now,
    transitions,
    ...(cappedAt !== undefined && { cappedAt })
  };
}
