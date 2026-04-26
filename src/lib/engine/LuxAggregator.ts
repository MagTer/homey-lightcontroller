/**
 * LuxAggregator - Multi-sensor lux averaging with 3-reading debounce
 *
 * Records per-sensor lux readings with timestamps, averages across fresh
 * sensors per tick, maintains a 3-reading rolling window, and exposes
 * smoothed lux plus diagnostics for observability.
 */

export interface SensorReading {
  sensorId: string;
  lux: number;
  at: Date;
}

export interface SensorDiagnostics {
  id: string;
  lastValue: number | null;
  lastSeenAgeMs: number;
  isStale: boolean;
}

export interface LuxDiagnostics {
  sensors: SensorDiagnostics[];
  window: number[];
  smoothed: number | null;
}

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Records per-sensor lux readings with timestamps, computes a per-tick
 * network average across non-stale sensors, and maintains a 3-reading
 * rolling window.
 *
 * Cold-start: first reading adopted immediately as smoothed value
 * (no 3-tick warm-up).  Sensor-dropout: readings older than
 * staleAfterMs are excluded; if no fresh sensors remain,
 * getSmoothedLux() returns null.
 */
export class LuxAggregator {
  private readonly staleAfterMs: number;
  private readings = new Map<string, SensorReading>();

  /** Rolling window of per-tick network averages — max 3 entries */
  private window: number[] = [];

  constructor(staleAfterMs = DEFAULT_STALE_AFTER_MS) {
    this.staleAfterMs = staleAfterMs;
  }

  /**
   * Record a lux reading from a specific sensor.
   * Replaces any prior reading for the same sensorId.
   */
  recordReading(sensorId: string, lux: number, at: Date): void {
    this.readings.set(sensorId, { sensorId, lux, at });
  }

  /**
   * Snapshot the current per-sensor average into the rolling window.
   * This is the only surface that mutates the window.
   *
   * Stale sensors (last reading older than staleAfterMs) are excluded.
   * If no fresh sensors remain, nothing is pushed to the window.
   */
  tick(now: Date): void {
    const fresh = this.freshReadings(now);
    if (fresh.length === 0) return;

    const avg = fresh.reduce((sum, r) => sum + r.lux, 0) / fresh.length;
    this.window.push(avg);
    if (this.window.length > 3) {
      this.window.shift();
    }
  }

  /**
   * Returns the smoothed lux value: average of the rolling window.
   * Cold-start: if the window is empty but there are sensor readings,
   * the last per-tick network average is returned immediately (first
   * reading adopted without waiting for 3 ticks).
   * Returns null if no readings exist and the window is empty.
   *
   * The `now` parameter is optional; when omitted, `new Date()` is used.
   * Pass an explicit `now` when the caller controls time (e.g., tests).
   */
  getSmoothedLux(now?: Date): number | null {
    return this.getSmoothedLuxFor(now ?? new Date());
  }

  /**
   * Diagnostics surface for observability.
   * Returns per-sensor status, current rolling window contents,
   * and the smoothed value.
   */
  getDiagnostics(now: Date): LuxDiagnostics {
    return {
      sensors: Array.from(this.readings.entries()).map(([id, r]) => {
        const ageMs = now.getTime() - r.at.getTime();
        return {
          id,
          lastValue: r.lux,
          lastSeenAgeMs: ageMs,
          isStale: ageMs > this.staleAfterMs
        };
      }),
      window: [...this.window],
      smoothed: this.getSmoothedLuxFor(now)
    };
  }

  // --- private helpers ---

  private staleCheck(at: Date, now: Date): boolean {
    return now.getTime() - at.getTime() < this.staleAfterMs;
  }

  private freshReadings(now: Date): SensorReading[] {
    return Array.from(this.readings.values()).filter(r =>
      this.staleCheck(r.at, now)
    );
  }

  private getSmoothedLuxFor(now: Date): number | null {
    if (this.window.length > 0) {
      return this.window.reduce((sum, v) => sum + v, 0) / this.window.length;
    }
    const fresh = this.freshReadings(now);
    if (fresh.length > 0) {
      return fresh.reduce((sum, r) => sum + r.lux, 0) / fresh.length;
    }
    return null;
  }
}
