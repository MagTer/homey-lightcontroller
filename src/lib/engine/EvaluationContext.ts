/**
 * EvaluationContext - Input context for phase engine evaluation
 *
 * Provides all external inputs needed to determine the active lighting phase,
 * including current time, ambient light level, location coordinates, and
 * an optional logger for warnings.
 */

import type { LuxAggregator } from './LuxAggregator.js';

/**
 * Simple logger type for injectable logging
 */
export type Logger = (msg: string) => void;

/**
 * Context object containing all inputs required for phase evaluation
 */
export interface EvaluationContext {
  /** Current time to evaluate against */
  now: Date;

  /** Ambient light level in lux, or null if not available */
  lux: number | null;

  /** Latitude for solar calculations */
  latitude: number;

  /** Longitude for solar calculations */
  longitude: number;

  /** ISO country code (e.g., 'NL', 'US') for holiday detection */
  countryCode: string;

  /** Optional logger for warnings (defaults to no-op) */
  logger?: Logger;
}

/**
 * Arguments for buildEvaluationContext factory.
 * The aggregator drives smoothed lux into the context.
 */
export interface BuildEvalContextArgs {
  /** LuxAggregator whose readings feed the smoothed lux value */
  aggregator: LuxAggregator;
  /** Current wall-clock time for this evaluation tick */
  now: Date;
  /** Latitude for solar calculations */
  latitude: number;
  /** Longitude for solar calculations */
  longitude: number;
  /** ISO country code for holiday detection */
  countryCode: string;
  /** Optional logger */
  logger?: Logger;
}

/**
 * Factory: ticks the aggregator, then builds an EvaluationContext
 * with smoothed lux wired in as ctx.lux.
 *
 * This is the single seam where LuxAggregator enters the engine.
 * Swap this factory to inject diagnostics or alternative smoothing.
 */
export function buildEvaluationContext(args: BuildEvalContextArgs): EvaluationContext {
  args.aggregator.tick(args.now);
  return {
    now: args.now,
    lux: args.aggregator.getSmoothedLux(args.now),
    latitude: args.latitude,
    longitude: args.longitude,
    countryCode: args.countryCode,
    logger: args.logger
  };
}
