import { describe, it, expect, vi } from 'vitest';
import { LuxAggregator } from '../../src/lib/engine/LuxAggregator.js';

describe('LuxAggregator', () => {
  // (a) cold start adopts first reading
  describe('cold start', () => {
    it('adopts the first reading immediately as smoothed lux', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T18:00:00Z'));
      try {
        const agg = new LuxAggregator();
        const t0 = new Date('2026-01-01T18:00:00Z');

        agg.recordReading('s1', 150, t0);

        // No tick called yet — cold start should return the reading
        expect(agg.getSmoothedLux()).toBe(150);
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns null when no readings have been recorded', () => {
      const agg = new LuxAggregator();
      expect(agg.getSmoothedLux()).toBeNull();
    });
  });

  // (f) multi-sensor averaging works per tick
  describe('multi-sensor averaging', () => {
    it('averages multiple sensors per tick', () => {
      const agg = new LuxAggregator();
      const t0 = new Date('2026-01-01T18:00:00Z');

      agg.recordReading('s1', 100, t0);
      agg.recordReading('s2', 200, t0);
      agg.tick(t0);

      // After tick the window contains [150] (avg of 100 and 200)
      expect(agg.getDiagnostics(t0).window).toEqual([150]);
      expect(agg.getSmoothedLux()).toBe(150);
    });

    it('updates when sensors report new readings before the next tick', () => {
      const agg = new LuxAggregator();
      const t0 = new Date('2026-01-01T18:00:00Z');
      const t1 = new Date('2026-01-01T18:05:00Z');

      agg.recordReading('s1', 100, t0);
      agg.recordReading('s2', 200, t0);
      agg.tick(t0);

      // Update sensor s1 and s2 (s2's prior reading would be exactly 5 min stale)
      agg.recordReading('s1', 120, t1);
      agg.recordReading('s2', 200, t1);
      agg.tick(t1);

      // Window now [150, 160] (avg of fresh sensors s1=120, s2=200)
      expect(agg.getDiagnostics(t1).window).toEqual([150, 160]);
    });
  });

  // (d) a sensor going stale stops contributing
  describe('stale sensor handling', () => {
    it('stale sensor (default 5 min) is excluded from tick average', () => {
      const agg = new LuxAggregator();
      const t0 = new Date('2026-01-01T18:00:00Z');
      const tStale = new Date('2026-01-01T18:01:00Z'); // only 1 min ago

      agg.recordReading('s1', 100, tStale); // stale relative to t0 + 5min
      agg.recordReading('s2', 200, tStale);
      agg.tick(tStale);

      // Both are fresh at tStale
      expect(agg.getDiagnostics(tStale).sensors.every(s => !s.isStale)).toBe(true);

      const tAfter5min = new Date('2026-01-01T18:06:00Z'); // 5+ min later
      agg.tick(tAfter5min);

      // No fresh sensors → nothing pushed to window
      expect(agg.getDiagnostics(tAfter5min).window).toEqual([150]); // old window preserved
    });

    it('configurable stale threshold', () => {
      // 30-second stale threshold
      const agg = new LuxAggregator(30_000);
      const t0 = new Date('2026-01-01T18:00:00Z');
      const t31sec = new Date('2026-01-01T18:00:31Z');

      agg.recordReading('s1', 100, t0);
      agg.tick(t0);
      expect(agg.getDiagnostics(t0).window).toEqual([100]);

      // After 31 seconds s1 is stale
      agg.tick(t31sec);
      expect(agg.getDiagnostics(t31sec).window).toEqual([100]); // stale excluded, old window stays
    });
  });

  // (e) all sensors stale returns null
  describe('all-sensors-stale path', () => {
    it('getSmoothedLux returns null when all sensors are stale and window is empty', () => {
      const agg = new LuxAggregator();
      const t0 = new Date('2026-01-01T18:00:00Z');
      const tAfterStale = new Date('2026-01-01T18:06:00Z'); // 6 min later

      agg.recordReading('s1', 100, t0);
      // No tick called; after 6 min reading is stale
      expect(agg.getSmoothedLux()).toBeNull();
    });

    it('getDiagnostics shows isStale: true for stale sensors', () => {
      const agg = new LuxAggregator();
      const t0 = new Date('2026-01-01T18:00:00Z');
      const tAfterStale = new Date('2026-01-01T18:06:00Z');

      agg.recordReading('s1', 100, t0);
      const diag = agg.getDiagnostics(tAfterStale);

      expect(diag.sensors[0].isStale).toBe(true);
      expect(diag.smoothed).toBeNull();
    });
  });

  // (b) transient single-tick lightning spike does not move smoothed past threshold
  describe('transient spike suppression', () => {
    it('a single high spike does not raise smoothed lux past threshold when surrounded by low readings', () => {
      const agg = new LuxAggregator();

      const t0 = new Date('2026-01-01T17:58:00Z');
      const t1 = new Date('2026-01-01T17:59:00Z');
      const t2 = new Date('2026-01-01T18:00:00Z');
      const t3 = new Date('2026-01-01T18:01:00Z');
      const t4 = new Date('2026-01-01T18:02:00Z');

      // Normal dusk readings
      agg.recordReading('s1', 50, t0);
      agg.tick(t0); // window: [50]

      agg.recordReading('s1', 55, t1);
      agg.tick(t1); // window: [50, 55]

      // Lightning spike!
      agg.recordReading('s1', 5000, t2);
      agg.tick(t2); // window: [50, 55, 5000]

      // Smoothed = (50+55+5000)/3 = 1701.7 < 2000 — no trigger
      expect(agg.getSmoothedLux()).toBeLessThan(2000);

      // Recovery
      agg.recordReading('s1', 52, t3);
      agg.tick(t3); // window: [55, 5000, 52]

      agg.recordReading('s1', 50, t4);
      agg.tick(t4); // window: [5000, 52, 50]

      // Smoothed = (5000+52+50)/3 ≈ 1700 — still recovering
      expect(agg.getSmoothedLux()).toBeGreaterThan(1500);

      // Fifth tick: spike ages out
      const t5 = new Date('2026-01-01T18:03:00Z');
      agg.recordReading('s1', 48, t5);
      agg.tick(t5); // window: [52, 50, 48]

      expect(agg.getSmoothedLux()).toBeLessThan(100); // back to normal
    });
  });

  // (c) sustained high readings eventually shift the smoothed value
  describe('sustained high readings shift smoothed lux', () => {
    it('three consecutive high readings raise smoothed lux above threshold', () => {
      const agg = new LuxAggregator();

      const t0 = new Date('2026-01-01T17:58:00Z');
      const t1 = new Date('2026-01-01T17:59:00Z');
      const t2 = new Date('2026-01-01T18:00:00Z');
      const t3 = new Date('2026-01-01T18:01:00Z');

      agg.recordReading('s1', 2100, t0);
      agg.tick(t0); // window: [2100]

      agg.recordReading('s1', 2200, t1);
      agg.tick(t1); // window: [2100, 2200]

      agg.recordReading('s1', 2300, t2);
      agg.tick(t2); // window: [2100, 2200, 2300]

      // Smoothed = 6600/3 = 2200 — above the 2000 threshold
      expect(agg.getSmoothedLux()).toBeGreaterThan(2000);
    });
  });

  // (g) getDiagnostics reports per-sensor ages and current window
  describe('getDiagnostics', () => {
    it('reports per-sensor ages, stale status, and current window', () => {
      const agg = new LuxAggregator();
      const t0 = new Date('2026-01-01T18:00:00Z');

      agg.recordReading('s1', 100, t0);
      agg.recordReading('s2', 200, t0);
      agg.tick(t0);

      const diag = agg.getDiagnostics(t0);

      expect(diag.sensors).toHaveLength(2);
      expect(diag.sensors.find(s => s.id === 's1')!.lastValue).toBe(100);
      expect(diag.sensors.find(s => s.id === 's2')!.lastValue).toBe(200);
      expect(diag.sensors.every(s => s.lastSeenAgeMs === 0)).toBe(true);
      expect(diag.sensors.every(s => s.isStale === false)).toBe(true);
      expect(diag.window).toEqual([150]);
      expect(diag.smoothed).toBe(150);
    });

    it('window is a copy (not a reference to internal state)', () => {
      const agg = new LuxAggregator();
      const t0 = new Date('2026-01-01T18:00:00Z');

      agg.recordReading('s1', 100, t0);
      agg.tick(t0);

      const diag = agg.getDiagnostics(t0);
      diag.window.push(999); // mutate the copy

      expect(agg.getDiagnostics(t0).window).toEqual([100]); // internal unchanged
    });
  });

  describe('rolling window capacity', () => {
    it('window is capped at 3 entries (oldest evicted)', () => {
      const agg = new LuxAggregator();
      const times = [
        new Date('2026-01-01T18:00:00Z'),
        new Date('2026-01-01T18:01:00Z'),
        new Date('2026-01-01T18:02:00Z'),
        new Date('2026-01-01T18:03:00Z'),
        new Date('2026-01-01T18:04:00Z')
      ];

      for (let i = 0; i < times.length; i++) {
        agg.recordReading('s1', (i + 1) * 10, times[i]);
        agg.tick(times[i]);
      }

      const diag = agg.getDiagnostics(times[4]);
      expect(diag.window).toEqual([30, 40, 50]); // oldest 10,20 evicted
    });
  });
});
