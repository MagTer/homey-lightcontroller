/**
 * Pure interpolation helpers for dimming curve calculations.
 * No timers, no IO, no external dependencies.
 */

// ---------------------------------------------------------------------------
// luxToDim
// ---------------------------------------------------------------------------

export interface LuxToDimParams {
  lux: number;
  brightLux: number; // lux value mapped to brightDim
  darkLux: number;    // lux value mapped to darkDim
  brightDim: number;  // dim output when lux >= brightLux (typically 0)
  darkDim: number;    // dim output when lux <= darkLux (typically 1)
}

/**
 * Maps a lux reading to a dim level via linear interpolation.
 *
 * - lux >= brightLux  →  brightDim
 * - lux <= darkLux    →  darkDim
 * - between          →  linear interpolation
 *
 * Inverted ranges (darkLux > brightLux): the same boundary checks apply.
 * The span direction determines which boundary check fires first so both
 * normal and inverted ranges correctly hit their respective boundary at the
 * exact threshold value without premature early-return.
 *
 * NaN / Infinity inputs → safe default (0).
 * Output is always clamped to [0, 1].
 */
export function luxToDim({
  lux,
  brightLux,
  darkLux,
  brightDim,
  darkDim,
}: LuxToDimParams): number {
  // Non-finite lux: safe default (0)
  if (!Number.isFinite(lux)) return 0;

  // Non-finite thresholds or dim values: safe default
  if (!Number.isFinite(brightLux) || !Number.isFinite(darkLux) ||
      !Number.isFinite(brightDim) || !Number.isFinite(darkDim)) {
    return 0;
  }

  const span = darkLux - brightLux;

  // Zero span: midpoint dim — checked BEFORE boundary conditions so
  // lux === brightLux === darkLux returns the midpoint, not brightDim
  if (span === 0) return (brightDim + darkDim) / 2;

  if (span > 0) {
    // darkLux > brightLux (inverted lux scale)
    // t = (lux - brightLux) / span ∈ [0, 1] when lux is in [brightLux, darkLux]
    const clampedLux = Math.min(Math.max(lux, brightLux), darkLux);
    const t = (clampedLux - brightLux) / span;
    const raw = brightDim + t * (darkDim - brightDim);
    return Math.min(Math.max(raw, 0), 1);
  } else {
    // brightLux > darkLux (normal lux scale): span < 0
    // t = (brightLux - clampedLux) / |span| ∈ [0, 1] when lux is in [darkLux, brightLux]
    // This formula keeps dim increasing as lux increases (brightDim → darkDim)
    const clampedLux = Math.min(Math.max(lux, darkLux), brightLux);
    const t = (brightLux - clampedLux) / -span;
    const raw = brightDim + t * (darkDim - brightDim);
    return Math.min(Math.max(raw, 0), 1);
  }
}

// ---------------------------------------------------------------------------
// twilightCurve
// ---------------------------------------------------------------------------

export interface TwilightCurveParams {
  now: number;      // Unix-ms timestamp
  startAt: number;  // Unix-ms when dim = startDim
  endAt: number;    // Unix-ms when dim = endDim
  startDim: number; // dim value at startAt
  endDim: number;   // dim value at endAt
}

/**
 * Maps a timestamp to a dim level via linear interpolation over a temporal window.
 *
 * - now <= startAt  →  startDim
 * - now >= endAt    →  endDim
 * - between        →  linear interpolation
 *
 * Zero-length window (startAt === endAt):
 *   now >= startAt  →  endDim
 *   otherwise      →  startDim
 *
 * NaN / Infinity inputs → safe default (0).
 * Output is always clamped to [0, 1].
 */
export function twilightCurve({
  now,
  startAt,
  endAt,
  startDim,
  endDim,
}: TwilightCurveParams): number {
  // Non-finite: safe default (0)
  if (!Number.isFinite(now) || !Number.isFinite(startAt) || !Number.isFinite(endAt) ||
      !Number.isFinite(startDim) || !Number.isFinite(endDim)) {
    return 0;
  }

  const span = endAt - startAt;

  // Zero-length window — checked BEFORE boundary conditions so equality
  // (now === startAt === endAt) falls here, not into a boundary branch
  if (span === 0) {
    return now >= startAt
      ? Math.min(Math.max(endDim,   0), 1)
      : Math.min(Math.max(startDim, 0), 1);
  }

  if (now <= startAt) return Math.min(Math.max(startDim, 0), 1);
  if (now >= endAt)   return Math.min(Math.max(endDim,   0), 1);

  const t = (now - startAt) / span;
  const raw = startDim + t * (endDim - startDim);
  return Math.min(Math.max(raw, 0), 1);
}
