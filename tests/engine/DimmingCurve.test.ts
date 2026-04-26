import { describe, it, expect } from 'vitest';
import { luxToDim, twilightCurve } from '../../src/lib/engine/DimmingCurve.js';

// ---------------------------------------------------------------------------
// luxToDim
// ---------------------------------------------------------------------------

describe('luxToDim', () => {
  const defaults = {
    brightLux: 1000,  // sunny threshold
    darkLux:   10,    // fully dark threshold
    brightDim: 0,     // bright → lights off
    darkDim:   1,     // dark   → lights on full
  };

  // (a) boundary values
  it('returns brightDim when lux >= brightLux', () => {
    expect(luxToDim({ lux: 1000, ...defaults })).toBe(0);
    expect(luxToDim({ lux: 2000, ...defaults })).toBe(0);
  });

  it('returns darkDim when lux <= darkLux', () => {
    expect(luxToDim({ lux: 10, ...defaults })).toBe(1);
    expect(luxToDim({ lux: 1,  ...defaults })).toBe(1);
  });

  // (b) midpoint interpolation
  it('linearly interpolates at the midpoint of the lux range', () => {
    // (1000 + 10) / 2 = 505 → t = 0.5 → dim = 0 + 0.5*(1-0) = 0.5
    expect(luxToDim({ lux: 505, ...defaults })).toBeCloseTo(0.5);
  });

  it('interpolates correctly for a quarter-point', () => {
    // Normal range (brightLux > darkLux): t = (1000 - clampedLux) / 990
    // dim=0.25 → 0.25 = t → clampedLux = 1000 - 247.5 = 752.5
    expect(luxToDim({ lux: 752.5, ...defaults })).toBeCloseTo(0.25);
  });

  // (c) clamping outside range
  it('clamps dim output to [0, 1] when range produces values beyond bounds', () => {
    // brightDim=1, darkDim=0 is inverted dim direction
    expect(luxToDim({ lux: 1500, brightLux: 1000, darkLux: 10, brightDim: 1, darkDim: 0 }))
      .toBe(1); // clamped at 1
    expect(luxToDim({ lux: 1,    brightLux: 1000, darkLux: 10, brightDim: 1, darkDim: 0 }))
      .toBe(0); // clamped at 0
  });

  // (g) inverted lux range (darkLux > brightLux)
  it('handles inverted lux range (darkLux > brightLux)', () => {
    // Darker = higher lux threshold, brighter = lower lux threshold
    // lux=505 is the midpoint of [10, 1000] → t = 0.5 → dim = 0.5
    const params = { lux: 505, brightLux: 10, darkLux: 1000, brightDim: 0, darkDim: 1 };
    expect(luxToDim(params)).toBeCloseTo(0.5);
  });

  it('returns brightDim at brightLux even when inverted', () => {
    expect(luxToDim({ lux: 10, brightLux: 10, darkLux: 1000, brightDim: 0, darkDim: 1 }))
      .toBe(0);
  });

  it('returns darkDim at darkLux even when inverted', () => {
    expect(luxToDim({ lux: 1000, brightLux: 10, darkLux: 1000, brightDim: 0, darkDim: 1 }))
      .toBe(1);
  });

  // NaN / Infinity
  it('returns safe default for non-finite lux', () => {
    expect(luxToDim({ lux: Infinity, ...defaults })).toBe(0);
    expect(luxToDim({ lux: -Infinity, ...defaults })).toBe(0);
    expect(luxToDim({ lux: NaN, ...defaults })).toBe(0);
  });

  it('returns closest clamped boundary for non-finite threshold', () => {
    expect(luxToDim({ lux: 500, brightLux: NaN, darkLux: 10, brightDim: 0, darkDim: 1 }))
      .toBe(0);
  });

  // Zero span
  it('returns midpoint dim when brightLux === darkLux', () => {
    expect(luxToDim({ lux: 500, brightLux: 500, darkLux: 500, brightDim: 0, darkDim: 1 }))
      .toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// twilightCurve
// ---------------------------------------------------------------------------

describe('twilightCurve', () => {
  // baseline temporal window
  const t0 = 1_700_000_000_000; // startAt
  const t1 = 1_700_000_360_000; // endAt  (1 hour later)
  const defaults = { startAt: t0, endAt: t1, startDim: 0.2, endDim: 0.8 };

  // (d) before / after window
  it('returns startDim when now < startAt', () => {
    expect(twilightCurve({ now: t0 - 1, ...defaults })).toBeCloseTo(0.2);
    expect(twilightCurve({ now: t0 - 3_600_000, ...defaults })).toBeCloseTo(0.2); // 1h before
  });

  it('returns endDim when now > endAt', () => {
    expect(twilightCurve({ now: t1 + 1, ...defaults })).toBeCloseTo(0.8);
    expect(twilightCurve({ now: t1 + 3_600_000, ...defaults })).toBeCloseTo(0.8); // 1h after
  });

  // (e) midpoint interpolation
  it('linearly interpolates at the midpoint of the window', () => {
    const midpoint = t0 + (t1 - t0) / 2;
    expect(twilightCurve({ now: midpoint, ...defaults })).toBeCloseTo(0.5);
  });

  it('interpolates correctly for a quarter-point', () => {
    const quarter = t0 + (t1 - t0) / 4;
    // dim = 0.2 + 0.25*(0.8-0.2) = 0.2 + 0.15 = 0.35
    expect(twilightCurve({ now: quarter, ...defaults })).toBeCloseTo(0.35);
  });

  // (f) zero-length window
  it('returns endDim when now >= startAt (zero-length window)', () => {
    const zeroStart = 1_700_000_000_000;
    const zeroEnd   = zeroStart; // same timestamp
    expect(twilightCurve({ now: zeroStart, startAt: zeroStart, endAt: zeroEnd, startDim: 0.2, endDim: 0.9 }))
      .toBeCloseTo(0.9);
    expect(twilightCurve({ now: zeroStart + 1, startAt: zeroStart, endAt: zeroEnd, startDim: 0.2, endDim: 0.9 }))
      .toBeCloseTo(0.9);
  });

  it('returns startDim when now < startAt (zero-length window)', () => {
    const zeroStart = 1_700_000_000_000;
    const zeroEnd   = zeroStart;
    expect(twilightCurve({ now: zeroStart - 1, startAt: zeroStart, endAt: zeroEnd, startDim: 0.2, endDim: 0.9 }))
      .toBeCloseTo(0.2);
  });

  // NaN / Infinity
  it('returns safe default for non-finite now', () => {
    expect(twilightCurve({ now: NaN,      ...defaults })).toBe(0);
    expect(twilightCurve({ now: Infinity,  ...defaults })).toBe(0);
    expect(twilightCurve({ now: -Infinity, ...defaults })).toBe(0);
  });

  it('clamps dim output to [0, 1]', () => {
    const curve = { now: t0 + (t1 - t0) / 2, startAt: t0, endAt: t1, startDim: -0.5, endDim: 2 };
    expect(twilightCurve(curve)).toBe(0.75); // (-0.5 + 2)/2 = 0.75, within bounds
    // Edge: start below 0
    expect(twilightCurve({ now: t0 + (t1 - t0) / 4, startAt: t0, endAt: t1, startDim: -0.5, endDim: 0.5 }))
      .toBe(0);
    // Edge: end above 1
    expect(twilightCurve({ now: t0 + (t1 - t0) * 0.75, startAt: t0, endAt: t1, startDim: 0.5, endDim: 1.5 }))
      .toBe(1);
  });
});
