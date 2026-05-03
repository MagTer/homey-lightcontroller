/**
 * Reconciler - Enforces phase target states on devices with drift detection
 *
 * The Reconciler translates Phase definitions into concrete device commands
 * via a dependency-injected DeviceAPI. It provides:
 *
 * - 50ms inter-command delay for mesh-network protection
 * - Drift detection to respect manual overrides during maintenance ticks
 * - Structured per-tick results for diagnostic visibility
 */

import type { Phase, AppConfig, RoleState, DimmingConfig } from '../config/Config.js';
import type {
  DeviceAPI,
  DeviceState,
  RoleDeviceMapping,
  Capability,
  CapabilityValue,
} from './DeviceAPI.js';
import type {
  ReconcileResult,
  AppliedReconcileEntry,
  SkippedReconcileEntry,
  FailedReconcileEntry,
  NoOpReconcileEntry,
} from './ReconcilerTypes.js';
import { luxToDim } from './DimmingCurve.js';

/**
 * Options for Reconciler configuration.
 */
export interface ReconcilerOptions {
  /** Delay between device commands in milliseconds (default: 50) */
  meshDelayMs?: number;
  /** Epsilon for floating-point dim comparison (default: 0.01) */
  dimEpsilon?: number;
  /** Delay before single retry on transient failure (default: 200) */
  retryDelayMs?: number;
  /** Provider for smoothed lux value, used when a role has dynamic dimming config */
  luxProvider?: () => number | null;
}

/**
 * Tracks the last known app-set state for a device.
 */
interface TrackedDeviceState {
  onoff?: boolean;
  dim?: number;
}

/**
 * Reconciler enforces phase target states on devices.
 *
 * Usage:
 * ```ts
 * const reconciler = new Reconciler(deviceApi, { meshDelayMs: 50 });
 * const result = await reconciler.reconcile(phase, config, roleDeviceMapping);
 * console.log(reconciler.getLastResult()); // Access most recent result
 * ```
 */
export class Reconciler {
  private deviceApi: DeviceAPI;
  private meshDelayMs: number;
  private dimEpsilon: number;
  private retryDelayMs: number;
  private luxProvider: (() => number | null) | undefined;

  private currentPhase: Phase | null = null;
  private lastAppSetState: Map<string, TrackedDeviceState> = new Map();
  private lastResult: ReconcileResult | null = null;

  /**
   * Creates a new Reconciler instance.
   *
   * @param deviceApi - The DeviceAPI implementation for device operations
   * @param options - Optional configuration for mesh delay and dim epsilon
   */
  constructor(deviceApi: DeviceAPI, options: ReconcilerOptions = {}) {
    this.deviceApi = deviceApi;
    this.meshDelayMs = options.meshDelayMs ?? 50;
    this.dimEpsilon = options.dimEpsilon ?? 0.01;
    this.retryDelayMs = options.retryDelayMs ?? 200;
    this.luxProvider = options.luxProvider;
  }

  /**
   * Gets the most recent reconcile result.
   *
   * @returns The last ReconcileResult or null if reconcile hasn't been called
   */
  getLastResult(): ReconcileResult | null {
    return this.lastResult;
  }

  /**
   * Resolves a RoleState, computing dynamic dim if a dimming config is present.
   * Falls back to static dim when lux is unavailable or dimming is not configured.
   */
  private resolveTargetState(raw: RoleState): RoleState {
    if (!raw.dimming) return raw;

    const lux = this.luxProvider ? this.luxProvider() : null;
    if (lux === null) return { onoff: raw.onoff, dim: raw.dim };

    const computedDim = luxToDim({
      lux,
      brightLux: raw.dimming.brightLux,
      darkLux: raw.dimming.darkLux,
      brightDim: raw.dimming.brightDim,
      darkDim: raw.dimming.darkDim,
    });

    return { onoff: raw.onoff, dim: computedDim };
  }

  /**
   * Reconciles devices to match the target phase state.
   *
   * In 'transition' mode (phase changed), all devices are updated to target state.
   * In 'maintenance' mode (same phase), devices are checked for drift and only
   * updated if they match the expected state (no manual override detected).
   *
   * @param phase - The target phase to reconcile to
   * @param config - The application configuration with phase definitions
   * @param roleDeviceMapping - Maps role IDs to device IDs
   * @returns Structured result with applied, skipped, failed, and no-op entries
   */
  async reconcile(
    phase: Phase,
    config: AppConfig,
    roleDeviceMapping: RoleDeviceMapping
  ): Promise<ReconcileResult> {
    // Determine mode: transition if phase changed, maintenance otherwise
    const mode: 'transition' | 'maintenance' =
      phase !== this.currentPhase ? 'transition' : 'maintenance';

    if (mode === 'transition') {
      this.currentPhase = phase;
    }

    const applied: AppliedReconcileEntry[] = [];
    const skipped: SkippedReconcileEntry[] = [];
    const failed: FailedReconcileEntry[] = [];
    const noOp: NoOpReconcileEntry[] = [];

    const phaseConfig = config.phases[phase];
    const roleStates = phaseConfig.states;

    // Process each role in the phase configuration
    for (const [roleId, rawTargetState] of Object.entries(roleStates)) {
      const targetState = this.resolveTargetState(rawTargetState);
      const deviceIds = roleDeviceMapping[roleId] ?? [];

      // Process each device assigned to this role
      for (const deviceId of deviceIds) {
        try {
          if (mode === 'transition') {
            await this.handleTransitionMode(
              deviceId,
              roleId,
              targetState,
              applied,
              failed
            );
          } else {
            await this.handleMaintenanceMode(
              deviceId,
              roleId,
              targetState,
              applied,
              skipped,
              failed,
              noOp
            );
          }
        } catch (error) {
          // Catch any unexpected errors to prevent one device from breaking the queue
          const message =
            error instanceof Error ? error.message : String(error);
          failed.push({
            deviceId,
            roleId,
            capability: 'onoff', // Default to onoff for general errors
            reason: 'error',
            message: `Unexpected error: ${message}`,
          });
        }
      }
    }

    const result: ReconcileResult = {
      applied,
      skipped,
      failed,
      noOp,
      phase,
      mode,
      timestamp: new Date(),
    };

    this.lastResult = result;
    return result;
  }

  /**
   * Handles device updates in transition mode (phase changed).
   * All capabilities are applied unconditionally.
   */
  private async handleTransitionMode(
    deviceId: string,
    roleId: string,
    targetState: RoleState,
    applied: AppliedReconcileEntry[],
    failed: FailedReconcileEntry[]
  ): Promise<void> {
    // Handle onoff capability (always present)
    try {
      await this.setCapabilityWithRetry(deviceId, 'onoff', targetState.onoff);
      this.updateLastAppSetState(deviceId, 'onoff', targetState.onoff);
      applied.push({
        deviceId,
        roleId,
        capability: 'onoff',
        reason: 'transition',
        value: targetState.onoff,
      });
      await this.delay();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({
        deviceId,
        roleId,
        capability: 'onoff',
        reason: 'error',
        message,
      });
      await this.delay();
      return; // Skip dim if onoff failed (device may be unreachable)
    }

    // Handle dim capability (only if defined in target)
    if (targetState.dim !== undefined) {
      try {
        await this.setCapabilityWithRetry(deviceId, 'dim', targetState.dim);
        this.updateLastAppSetState(deviceId, 'dim', targetState.dim);
        applied.push({
          deviceId,
          roleId,
          capability: 'dim',
          reason: 'transition',
          value: targetState.dim,
        });
        await this.delay();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({
          deviceId,
          roleId,
          capability: 'dim',
          reason: 'error',
          message,
        });
        await this.delay();
      }
    }
  }

  /**
   * Handles device updates in maintenance mode (same phase).
   * Checks for drift and respects manual overrides.
   */
  private async handleMaintenanceMode(
    deviceId: string,
    roleId: string,
    targetState: RoleState,
    applied: AppliedReconcileEntry[],
    skipped: SkippedReconcileEntry[],
    failed: FailedReconcileEntry[],
    noOp: NoOpReconcileEntry[]
  ): Promise<void> {
    // Get current device state
    let currentState: DeviceState;
    try {
      currentState = await this.deviceApi.getState(deviceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({
        deviceId,
        roleId,
        capability: 'onoff',
        reason: 'error',
        message: `Failed to get state: ${message}`,
      });
      return;
    }

    const lastSet = this.lastAppSetState.get(deviceId);

    // Check for drift on tracked capabilities
    const driftDetected = this.checkForDrift(
      deviceId,
      roleId,
      currentState,
      lastSet,
      skipped
    );

    if (driftDetected) {
      // Device has been manually overridden - skip it
      return;
    }

    // No drift - check if device needs to be updated to target
    const onoffNeedsUpdate = currentState.onoff !== targetState.onoff;
    const dimNeedsUpdate =
      targetState.dim !== undefined &&
      (currentState.dim === undefined ||
        Math.abs(currentState.dim - targetState.dim) > this.dimEpsilon);

    if (!onoffNeedsUpdate && !dimNeedsUpdate) {
      // Device already in target state
      noOp.push({
        deviceId,
        roleId,
        capability: 'onoff',
        reason: 'no-op',
        value: targetState.onoff,
      });
      if (targetState.dim !== undefined) {
        noOp.push({
          deviceId,
          roleId,
          capability: 'dim',
          reason: 'no-op',
          value: targetState.dim,
        });
      }
      return;
    }

    // Recovery case: apply target state
    await this.applyMaintenanceUpdate(
      deviceId,
      roleId,
      targetState,
      currentState,
      applied,
      failed
    );
  }

  /**
   * Checks if the device has drifted from its last app-set state.
   * Returns true if drift is detected and skip entries are added.
   */
  private checkForDrift(
    deviceId: string,
    roleId: string,
    currentState: DeviceState,
    lastSet: TrackedDeviceState | undefined,
    skipped: SkippedReconcileEntry[]
  ): boolean {
    if (!lastSet) {
      return false; // No previous app-set state to compare against
    }

    // Check onoff drift
    if (lastSet.onoff !== undefined && currentState.onoff !== lastSet.onoff) {
      skipped.push({
        deviceId,
        roleId,
        capability: 'onoff',
        reason: 'override-skip',
        lastAppSetState: lastSet.onoff,
        observedState: currentState.onoff ?? false,
      });
      return true;
    }

    // Check dim drift
    if (
      lastSet.dim !== undefined &&
      currentState.dim !== undefined &&
      Math.abs(currentState.dim - lastSet.dim) > this.dimEpsilon
    ) {
      skipped.push({
        deviceId,
        roleId,
        capability: 'dim',
        reason: 'override-skip',
        lastAppSetState: lastSet.dim,
        observedState: currentState.dim,
      });
      return true;
    }

    return false;
  }

  /**
   * Applies target state updates during maintenance mode.
   */
  private async applyMaintenanceUpdate(
    deviceId: string,
    roleId: string,
    targetState: RoleState,
    currentState: DeviceState,
    applied: AppliedReconcileEntry[],
    failed: FailedReconcileEntry[]
  ): Promise<void> {
    // Update onoff if needed
    if (currentState.onoff !== targetState.onoff) {
      try {
        await this.setCapabilityWithRetry(deviceId, 'onoff', targetState.onoff);
        this.updateLastAppSetState(deviceId, 'onoff', targetState.onoff);
        applied.push({
          deviceId,
          roleId,
          capability: 'onoff',
          reason: 'maintenance-target',
          value: targetState.onoff,
        });
        await this.delay();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({
          deviceId,
          roleId,
          capability: 'onoff',
          reason: 'error',
          message,
        });
        await this.delay();
        return;
      }
    }

    // Update dim if needed and defined in target
    if (targetState.dim !== undefined && currentState.dim !== targetState.dim) {
      try {
        await this.setCapabilityWithRetry(deviceId, 'dim', targetState.dim);
        this.updateLastAppSetState(deviceId, 'dim', targetState.dim);
        applied.push({
          deviceId,
          roleId,
          capability: 'dim',
          reason: 'maintenance-target',
          value: targetState.dim,
        });
        await this.delay();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({
          deviceId,
          roleId,
          capability: 'dim',
          reason: 'error',
          message,
        });
        await this.delay();
      }
    }
  }

  /**
   * Updates the tracked last-app-set state for a device capability.
   */
  private updateLastAppSetState(
    deviceId: string,
    capability: Capability,
    value: boolean | number
  ): void {
    let state = this.lastAppSetState.get(deviceId);
    if (!state) {
      state = {};
      this.lastAppSetState.set(deviceId, state);
    }
    state[capability] = value as never;
  }

  /**
   * Applies the configured mesh delay between commands.
   */
  private async delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.meshDelayMs));
  }

  /**
   * Applies the configured retry delay before a single retry attempt.
   */
  private async retryDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
  }

  /**
   * Attempts to set a device capability, retrying once on transient failure.
   * The second-attempt error is what surfaces in FailedReconcileEntry if both
   * attempts fail; the first error is intentionally swallowed.
   */
  private async setCapabilityWithRetry<T extends 'onoff' | 'dim'>(
    deviceId: string,
    capability: T,
    value: CapabilityValue<T>
  ): Promise<void> {
    try {
      await this.deviceApi.setCapability(deviceId, capability, value);
    } catch (firstError) {
      await this.retryDelay();
      // Second attempt — if this also fails the error propagates to the
      // enclosing try/catch which records it in failed[] with this message.
      await this.deviceApi.setCapability(deviceId, capability, value);
    }
  }
}
