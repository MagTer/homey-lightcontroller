import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Reconciler } from '../../src/lib/engine/Reconciler.js';
import type { DeviceAPI, DeviceState, RoleDeviceMapping } from '../../src/lib/engine/DeviceAPI.js';
import type { AppConfig, Phase, DimmingConfig } from '../../src/lib/config/Config.js';
import type { ReconcileResult } from '../../src/lib/engine/ReconcilerTypes.js';

/**
 * Stateful mock DeviceAPI for testing.
 * Tracks actual device state and allows simulating manual user overrides.
 */
class MockDeviceAPI implements DeviceAPI {
  private state: Map<string, DeviceState> = new Map();
  private callCounts = {
    getState: 0,
    setCapability: 0,
  };
  private failingDevices: Set<string> = new Set();
  private failingCapabilities: Map<string, Set<string>> = new Map();

  async getState(deviceId: string): Promise<DeviceState> {
    this.callCounts.getState++;
    if (this.failingDevices.has(deviceId)) {
      throw new Error(`Device ${deviceId} is unreachable`);
    }
    return this.state.get(deviceId) ?? { onoff: false };
  }

  async setCapability<T extends 'onoff' | 'dim'>(
    deviceId: string,
    capability: T,
    value: T extends 'onoff' ? boolean : number
  ): Promise<void> {
    this.callCounts.setCapability++;

    // Check for "once" failure — fail once then clear so second attempt succeeds
    const onceKey = `${deviceId}::${capability}`;
    const deviceFailures = this.failingCapabilities.get(deviceId);
    if (deviceFailures?.has(`dim::once::${onceKey}`) || deviceFailures?.has(`onoff::once::${onceKey}`)) {
      deviceFailures?.delete(`dim::once::${onceKey}`);
      deviceFailures?.delete(`onoff::once::${onceKey}`);
      throw new Error(`Transient failure on ${capability} for ${deviceId}`);
    }

    // Check if this specific capability is configured to fail
    if (deviceFailures?.has(capability)) {
      throw new Error(`Capability ${capability} failed on ${deviceId}`);
    }

    if (this.failingDevices.has(deviceId)) {
      throw new Error(`Device ${deviceId} is unreachable`);
    }

    const current = this.state.get(deviceId) ?? {};
    this.state.set(deviceId, { ...current, [capability]: value });
  }

  /**
   * Simulate a manual user change to a device's state.
   */
  simulateManualChange(deviceId: string, partial: Partial<DeviceState>): void {
    const current = this.state.get(deviceId) ?? {};
    this.state.set(deviceId, { ...current, ...partial });
  }

  /**
   * Get the current state directly (for assertions).
   */
  getDeviceState(deviceId: string): DeviceState | undefined {
    return this.state.get(deviceId);
  }

  /**
   * Configure a device to fail all operations.
   */
  setDeviceFailing(deviceId: string, failing: boolean): void {
    if (failing) {
      this.failingDevices.add(deviceId);
    } else {
      this.failingDevices.delete(deviceId);
    }
  }

  /**
   * Configure a specific capability to fail on a device.
   */
  setCapabilityFailing(deviceId: string, capability: string, failing: boolean): void {
    if (failing) {
      const set = this.failingCapabilities.get(deviceId) ?? new Set();
      set.add(capability);
      this.failingCapabilities.set(deviceId, set);
    } else {
      this.failingCapabilities.get(deviceId)?.delete(capability);
      // Also clear any "once" marker for this capability
      const key = `${deviceId}::${capability}`;
      this.failingCapabilities.get(deviceId)?.delete(`dim::once::${key}`);
      this.failingCapabilities.get(deviceId)?.delete(`onoff::once::${key}`);
    }
  }

  /**
   * Configure a specific (deviceId, capability) pair to fail on the FIRST call only,
   * then automatically clear itself so the second call succeeds.
   * Useful for simulating transient failures that recover on retry.
   */
  setCapabilityFailingOnce(deviceId: string, capability: string): void {
    const key = `${deviceId}::${capability}`;
    const set = this.failingCapabilities.get(deviceId) ?? new Set();
    set.add(`${capability}::once::${key}`);
    this.failingCapabilities.set(deviceId, set);
  }

  getCallCounts() {
    return { ...this.callCounts };
  }

  reset(): void {
    this.state.clear();
    this.callCounts = { getState: 0, setCapability: 0 };
    this.failingDevices.clear();
    this.failingCapabilities.clear();
  }
}

// Test fixtures
function makeConfig(): AppConfig {
  return {
    version: '1.0.0',
    roles: [
      { id: 'living', name: 'Living Room' },
      { id: 'kitchen', name: 'Kitchen' },
    ],
    phases: {
      NIGHT: {
        weekday: { conditions: [{ type: 'time', at: '00:00' }] },
        weekend: { conditions: [{ type: 'time', at: '00:00' }] },
        states: {
          living: { onoff: false },
          kitchen: { onoff: false },
        },
      },
      MORNING: {
        weekday: { conditions: [{ type: 'time', at: '07:00' }] },
        weekend: { conditions: [{ type: 'time', at: '08:00' }] },
        states: {
          living: { onoff: true, dim: 0.5 },
          kitchen: { onoff: true, dim: 0.7 },
        },
      },
      DAY: {
        weekday: { conditions: [{ type: 'time', at: '09:00' }] },
        weekend: { conditions: [{ type: 'time', at: '09:00' }] },
        states: {
          living: { onoff: false },
          kitchen: { onoff: true, dim: 1.0 },
        },
      },
      EVENING: {
        weekday: { conditions: [{ type: 'time', at: '18:00' }] },
        weekend: { conditions: [{ type: 'time', at: '18:00' }] },
        states: {
          living: { onoff: true, dim: 0.8 },
          kitchen: { onoff: true, dim: 0.6 },
        },
      },
    },
  } as AppConfig;
}

const roleDeviceMapping: RoleDeviceMapping = {
  living: ['living-light-1', 'living-light-2'],
  kitchen: ['kitchen-light-1'],
};

describe('Reconciler', () => {
  let mockApi: MockDeviceAPI;
  let reconciler: Reconciler;

  beforeEach(() => {
    vi.useFakeTimers();
    mockApi = new MockDeviceAPI();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('transition mode', () => {
    it('applies target state to all role devices on phase transition', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10 });
      const config = makeConfig();

      // Start reconcile
      const reconcilePromise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      
      // Advance timers to let all delays complete
      await vi.advanceTimersByTimeAsync(200);
      const result = await reconcilePromise;

      // Should have applied onoff to all 3 devices, dim to all 3 (MORNING has dim)
      expect(result.applied).toHaveLength(6);
      expect(result.mode).toBe('transition');
      expect(result.phase).toBe('MORNING');

      // Verify each device got the correct values
      const living1Onoff = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'onoff'
      );
      expect(living1Onoff).toMatchObject({
        deviceId: 'living-light-1',
        roleId: 'living',
        capability: 'onoff',
        reason: 'transition',
        value: true,
      });

      const living1Dim = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(living1Dim).toMatchObject({
        deviceId: 'living-light-1',
        roleId: 'living',
        capability: 'dim',
        reason: 'transition',
        value: 0.5,
      });

      // Verify the mock state was updated
      expect(mockApi.getDeviceState('living-light-1')).toEqual({ onoff: true, dim: 0.5 });
      expect(mockApi.getDeviceState('kitchen-light-1')).toEqual({ onoff: true, dim: 0.7 });
    });

    it('phase transition overrides previous manual changes', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10 });
      const config = makeConfig();

      // First transition to NIGHT (lights off)
      let promise = reconciler.reconcile('NIGHT', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(100);
      await promise;
      expect(mockApi.getDeviceState('living-light-1')).toEqual({ onoff: false });

      // User manually turns on living-light-1
      mockApi.simulateManualChange('living-light-1', { onoff: true });
      expect(mockApi.getDeviceState('living-light-1')).toEqual({ onoff: true });

      // Transition to MORNING - should override the manual change
      promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      // Should apply MORNING state even though device was manually changed
      const living1Onoff = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'onoff'
      );
      expect(living1Onoff?.reason).toBe('transition');
      expect(mockApi.getDeviceState('living-light-1')).toEqual({ onoff: true, dim: 0.5 });
    });
  });

  describe('mesh delay', () => {
    it('enforces 50ms delay between commands', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 50 });
      const config = makeConfig();

      // Start reconcile (will queue 6 commands for MORNING: 3 onoff + 3 dim)
      const reconcilePromise = reconciler.reconcile('MORNING', config, roleDeviceMapping);

      // Advance 49ms - should have completed first command, waiting on delay
      await vi.advanceTimersByTimeAsync(49);
      const counts49 = mockApi.getCallCounts();
      expect(counts49.setCapability).toBeGreaterThanOrEqual(1);

      // Advance another 50ms (99ms total) - second command should execute
      await vi.advanceTimersByTimeAsync(50);
      const counts99 = mockApi.getCallCounts();
      expect(counts99.setCapability).toBeGreaterThanOrEqual(2);

      // Continue advancing until complete
      await vi.advanceTimersByTimeAsync(300);
      const result = await reconcilePromise;

      // All commands should have executed
      expect(result.applied).toHaveLength(6);
      expect(mockApi.getCallCounts().setCapability).toBe(6);
    });

    it('allows configurable mesh delay', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 100 });
      const config = makeConfig();

      const promise = reconciler.reconcile('NIGHT', config, roleDeviceMapping);

      await vi.advanceTimersByTimeAsync(50);
      const counts50 = mockApi.getCallCounts();
      expect(counts50.setCapability).toBe(1); // Only first command

      await vi.advanceTimersByTimeAsync(60); // 110ms total
      const counts110 = mockApi.getCallCounts();
      expect(counts110.setCapability).toBe(2); // Second command executed

      // Run all remaining timers to complete
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(mockApi.getCallCounts().setCapability).toBe(3);
    });
  });

  describe('maintenance mode and drift detection', () => {
    it('skips devices with manual override during maintenance', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10 });
      const config = makeConfig();

      // Transition to MORNING
      let promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      // User manually turns off living-light-1
      mockApi.simulateManualChange('living-light-1', { onoff: false });

      // Reconcile same phase - should detect drift and skip
      promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      expect(result.mode).toBe('maintenance');

      // living-light-1 onoff should be skipped due to override
      const living1Skipped = result.skipped.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'onoff'
      );
      expect(living1Skipped).toMatchObject({
        deviceId: 'living-light-1',
        roleId: 'living',
        capability: 'onoff',
        reason: 'override-skip',
        lastAppSetState: true,
        observedState: false,
      });

      // Other devices should continue normally (may be in applied or noOp)
      const living2Applied = result.applied.find(
        (e) => e.deviceId === 'living-light-2'
      ) ?? result.noOp.find(
        (e) => e.deviceId === 'living-light-2'
      );
      expect(living2Applied).toBeDefined();
    });

    it('detects dim drift as override', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10 });
      const config = makeConfig();

      // Transition to MORNING (dim=0.5 for living)
      let promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      // User manually changes dim level
      mockApi.simulateManualChange('living-light-1', { dim: 0.3 });

      // Reconcile same phase
      promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      const dimSkipped = result.skipped.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(dimSkipped).toMatchObject({
        reason: 'override-skip',
        lastAppSetState: 0.5,
        observedState: 0.3,
      });
    });

    it('respects dim epsilon tolerance (no false drift)', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, dimEpsilon: 0.01 });
      const config = makeConfig();

      // Transition to MORNING (dim=0.5)
      let promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      // Simulate tiny floating-point difference (within epsilon)
      mockApi.simulateManualChange('living-light-1', { dim: 0.5000001 });

      // Reconcile same phase
      promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      // Should NOT be treated as drift - device is already at target
      const dimSkip = result.skipped.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(dimSkip?.reason).not.toBe('override-skip');

      // Should be a no-op instead
      const dimNoOp = result.noOp.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(dimNoOp).toBeDefined();
      expect(dimNoOp?.reason).toBe('no-op');
    });
  });

  describe('error handling', () => {
    it('isolates per-device errors without breaking queue', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, retryDelayMs: 0 });
      const config = makeConfig();

      // Make one device fail
      mockApi.setDeviceFailing('living-light-1', true);

      const promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      // living-light-1 should be in failed[]
      const living1Failed = result.failed.find(
        (e) => e.deviceId === 'living-light-1'
      );
      expect(living1Failed).toBeDefined();
      expect(living1Failed?.reason).toBe('error');

      // Other devices should still be applied
      const living2Applied = result.applied.find(
        (e) => e.deviceId === 'living-light-2'
      );
      expect(living2Applied).toBeDefined();
    });

    it('handles missing capability errors per-device', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, retryDelayMs: 0 });
      const config = makeConfig();

      // Make dim fail on one device (like it's not dimmable)
      mockApi.setCapabilityFailing('living-light-1', 'dim', true);

      const promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      // living-light-1 dim should fail
      const dimFailed = result.failed.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(dimFailed).toBeDefined();
      expect(dimFailed?.reason).toBe('error');

      // living-light-1 onoff should still succeed
      const onoffApplied = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'onoff'
      );
      expect(onoffApplied).toBeDefined();

      // Other devices should succeed for both capabilities
      const living2Dim = result.applied.find(
        (e) => e.deviceId === 'living-light-2' && e.capability === 'dim'
      );
      expect(living2Dim).toBeDefined();
    });
  });

  describe('diagnostic surface', () => {
    it('lastResult exposes most recent tick result', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10 });
      const config = makeConfig();

      // Initial state - no result yet
      expect(reconciler.getLastResult()).toBeNull();

      // After first reconcile
      let promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result1 = await promise;
      expect(reconciler.getLastResult()).toBe(result1);
      expect(reconciler.getLastResult()?.phase).toBe('MORNING');

      // After second reconcile
      promise = reconciler.reconcile('DAY', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result2 = await promise;
      expect(reconciler.getLastResult()).toBe(result2);
      expect(reconciler.getLastResult()?.phase).toBe('DAY');
    });

    it('result contains structured diagnostics for all entry types', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10 });
      const config = makeConfig();

      // First establish state
      let promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      // Manual override for drift detection
      mockApi.simulateManualChange('living-light-1', { onoff: false });

      // Make one device fail
      mockApi.setDeviceFailing('kitchen-light-1', true);

      promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      // Verify all arrays exist and have correct structure
      expect(Array.isArray(result.applied)).toBe(true);
      expect(Array.isArray(result.skipped)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
      expect(Array.isArray(result.noOp)).toBe(true);

      // Verify result has required metadata
      expect(result.phase).toBe('MORNING');
      expect(result.mode).toBe('maintenance');
      expect(result.timestamp).toBeInstanceOf(Date);

      // Verify entry structures
      if (result.applied.length > 0) {
        const applied = result.applied[0];
        expect(applied).toHaveProperty('deviceId');
        expect(applied).toHaveProperty('roleId');
        expect(applied).toHaveProperty('capability');
        expect(applied).toHaveProperty('reason');
        expect(applied).toHaveProperty('value');
      }

      if (result.skipped.length > 0) {
        const skipped = result.skipped[0];
        expect(skipped).toHaveProperty('deviceId');
        expect(skipped).toHaveProperty('roleId');
        expect(skipped).toHaveProperty('capability');
        expect(skipped).toHaveProperty('reason');
        expect(skipped).toHaveProperty('lastAppSetState');
        expect(skipped).toHaveProperty('observedState');
        expect(skipped.reason).toBe('override-skip');
      }

      if (result.failed.length > 0) {
        const failed = result.failed[0];
        expect(failed).toHaveProperty('deviceId');
        expect(failed).toHaveProperty('roleId');
        expect(failed).toHaveProperty('capability');
        expect(failed).toHaveProperty('reason');
        expect(failed).toHaveProperty('message');
        expect(failed.reason).toBe('error');
      }
    });
  });

  describe('retry on transient failure', () => {
    // meshDelayMs:10 and retryDelayMs:200 are always numerically distinct so
    // timing assertions stay unambiguous throughout the retry tests.

    it('transient onoff failure recovers → entry lands in applied[], nothing in failed[]', async () => {
      // Arrange: living-light-1 onoff will fail once, then succeed
      mockApi.setCapabilityFailingOnce('living-light-1', 'onoff');
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, retryDelayMs: 200 });
      const config = makeConfig();

      // Act: start reconcile, advance past retryDelay (200ms), complete remaining delays
      const promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200); // retryDelayMs
      await vi.advanceTimersByTimeAsync(300); // remaining mesh delays
      const result = await promise;

      // Assert: setCapability called twice for the transient device
      expect(mockApi.getCallCounts().setCapability).toBeGreaterThanOrEqual(6);

      // Assert: transient device landed in applied[] (retry succeeded)
      const living1Onnoff = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'onoff'
      );
      expect(living1Onnoff).toBeDefined();
      expect(living1Onnoff?.reason).toBe('transition');

      // Assert: no entry in failed[] for living-light-1 onoff
      const living1Failed = result.failed.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'onoff'
      );
      expect(living1Failed).toBeUndefined();
    });

    it('persistent onoff failure → entry lands in failed[], message from second attempt', async () => {
      // Arrange: living-light-1 onoff fails on BOTH attempts
      mockApi.setCapabilityFailing('living-light-1', 'onoff', true);
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, retryDelayMs: 200 });
      const config = makeConfig();

      // Act
      const promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200); // retryDelay
      await vi.advanceTimersByTimeAsync(300); // remaining delays
      const result = await promise;

      // Assert: setCapability called twice for the persistent-failure device
      const countsBeforeRecovery = mockApi.getCallCounts().setCapability;

      // Assert: living-light-1 onoff is in failed[]
      const living1Failed = result.failed.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'onoff'
      );
      expect(living1Failed).toBeDefined();
      expect(living1Failed?.reason).toBe('error');
      // The message should be from the second-attempt error (the one that proves device is down)
      expect(living1Failed?.message).toMatch(/unreachable|failed/i);
    });

    it('maintenance mode transient failure recovers via applyMaintenanceUpdate path', async () => {
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, retryDelayMs: 200 });
      const config = makeConfig();

      // Establish baseline state via two transitions
      let promise = reconciler.reconcile('NIGHT', config, roleDeviceMapping);
      await vi.runAllTimersAsync();
      await promise;

      promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.runAllTimersAsync();
      await promise;

      // Clear tracking and mock state for living-light-1 to force maintenance recovery
      mockApi.simulateManualChange('living-light-1', { onoff: false });
      // @ts-expect-error - private field access for test setup
      reconciler.lastAppSetState.delete('living-light-1');
      mockApi.setCapabilityFailingOnce('living-light-1', 'onoff');

      // Act: MORNING maintenance recovery path
      promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200); // retryDelay
      await vi.advanceTimersByTimeAsync(100); // remaining mesh
      const result = await promise;

      // Assert: recovered via retry, landed in applied[]
      const living1Applied = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'onoff'
      );
      expect(living1Applied?.reason).toBe('maintenance-target');
      expect(result.failed.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'onoff'
      )).toBeUndefined();
    });

    it('retryDelayMs is configurable — timer advancement gates the retry', async () => {
      // Arrange: living-light-1 onoff fails once
      mockApi.setCapabilityFailingOnce('living-light-1', 'onoff');
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, retryDelayMs: 100 });
      const config = makeConfig();

      // Act: advance 99ms — still inside retry window, retry hasn't fired yet
      const promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(99);
      const counts99 = mockApi.getCallCounts();

      // After only 99ms, setCapability still at 1 (first attempt; retry delay = 100ms)
      expect(counts99.setCapability).toBeLessThan(2);

      // Act: advance 2 more ms (101 total) — retry delay has elapsed, retry fires
      await vi.advanceTimersByTimeAsync(2);
      const counts101 = mockApi.getCallCounts();
      expect(counts101.setCapability).toBeGreaterThanOrEqual(counts99.setCapability);

      // Complete remaining delays
      await vi.advanceTimersByTimeAsync(300);
      const result = await promise;

      // Assert: retry succeeded, entry is in applied[]
      const living1Applied = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'onoff'
      );
      expect(living1Applied).toBeDefined();
    });
  });

  describe('dynamic dimming via luxProvider', () => {
    const makeDimmingConfig = (overrides?: Partial<DimmingConfig>): DimmingConfig => ({
      source: 'indoor_downstairs',
      brightLux: 100,
      darkLux: 20,
      brightDim: 0,
      darkDim: 0.5,
      ...overrides,
    });

    it('computes dim from luxProvider during transition', async () => {
      const luxProvider = vi.fn().mockReturnValue(60); // midpoint-ish lux
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, luxProvider });

      const config = makeConfig();
      config.phases.MORNING.states.living = {
        onoff: true,
        dimming: makeDimmingConfig(),
      };

      const promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      // lux=60 between brightLux=100 and darkLux=20 → t=(100-60)/80=0.5 → dim=0.25
      const living1Dim = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(living1Dim).toBeDefined();
      expect(living1Dim!.value).toBeCloseTo(0.25, 2);
      expect(mockApi.getDeviceState('living-light-1')?.dim).toBeCloseTo(0.25, 2);
    });

    it('uses brightDim when lux >= brightLux', async () => {
      const luxProvider = vi.fn().mockReturnValue(150);
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, luxProvider });

      const config = makeConfig();
      config.phases.MORNING.states.living = {
        onoff: true,
        dimming: makeDimmingConfig(),
      };

      const promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      const living1Dim = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(living1Dim!.value).toBe(0);
    });

    it('uses darkDim when lux <= darkLux', async () => {
      const luxProvider = vi.fn().mockReturnValue(10);
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, luxProvider });

      const config = makeConfig();
      config.phases.MORNING.states.living = {
        onoff: true,
        dimming: makeDimmingConfig(),
      };

      const promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      const living1Dim = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(living1Dim!.value).toBe(0.5);
    });

    it('falls back to static dim when luxProvider returns null', async () => {
      const luxProvider = vi.fn().mockReturnValue(null);
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, luxProvider });

      const config = makeConfig();
      config.phases.MORNING.states.living = {
        onoff: true,
        dim: 0.7,
        dimming: makeDimmingConfig(),
      };

      const promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      const living1Dim = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(living1Dim!.value).toBe(0.7);
    });

    it('falls back to no dim when luxProvider returns null and no static dim', async () => {
      const luxProvider = vi.fn().mockReturnValue(null);
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, luxProvider });

      const config = makeConfig();
      config.phases.MORNING.states.living = {
        onoff: true,
        dimming: makeDimmingConfig(),
      };

      const promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      // No dim entry because dim is undefined and lux is null
      const living1Dim = result.applied.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(living1Dim).toBeUndefined();
    });

    it('respects manual override during maintenance with dynamic dimming', async () => {
      const luxProvider = vi.fn().mockReturnValue(60);
      reconciler = new Reconciler(mockApi, { meshDelayMs: 10, luxProvider });

      const config = makeConfig();
      config.phases.MORNING.states.living = {
        onoff: true,
        dimming: makeDimmingConfig(),
      };

      // Transition to MORNING to establish state
      let promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      // User manually changes dim
      mockApi.simulateManualChange('living-light-1', { dim: 0.1 });

      // Maintenance tick
      promise = reconciler.reconcile('MORNING', config, roleDeviceMapping);
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      const dimSkipped = result.skipped.find(
        (e) => e.deviceId === 'living-light-1' && e.capability === 'dim'
      );
      expect(dimSkipped).toBeDefined();
      expect(dimSkipped!.reason).toBe('override-skip');
    });
  });
});
