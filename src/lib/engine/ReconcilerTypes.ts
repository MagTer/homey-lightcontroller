/**
 * ReconcilerTypes - Type definitions for the lighting reconciler
 *
 * These types define the diagnostic surface used by both production code
 * and tests to inspect why devices were or were not touched during reconcile.
 */

import type { Phase, RoleState } from '../config/Config.js';
import type { Capability } from './DeviceAPI.js';

/**
 * Reasons for a reconcile entry outcome.
 */
export type ReconcileReason =
  | 'transition'      // Device updated due to phase transition
  | 'maintenance-target' // Device updated to match target state during maintenance
  | 'override-skip'   // Device skipped because it doesn't match lastAppSetState (manual override detected)
  | 'no-op'           // Device already in target state, no change needed
  | 'error';          // Device operation failed with an error

/**
 * Base entry in the reconcile result.
 */
export interface ReconcileEntry {
  /** Unique identifier for the device */
  deviceId: string;
  /** Role this device belongs to */
  roleId: string;
  /** Capability being modified */
  capability: Capability;
  /** Reason for this outcome */
  reason: ReconcileReason;
}

/**
 * Entry for successfully applied changes.
 */
export interface AppliedReconcileEntry extends ReconcileEntry {
  reason: 'transition' | 'maintenance-target' | 'no-op';
  /** Value that was (or would be) set */
  value: boolean | number;
}

/**
 * Entry for skipped devices due to manual override detection.
 */
export interface SkippedReconcileEntry extends ReconcileEntry {
  reason: 'override-skip';
  /** Last state known to be set by the app */
  lastAppSetState: boolean | number;
  /** Current observed state on the device */
  observedState: boolean | number;
}

/**
 * Entry for no-op devices (already in target state).
 */
export interface NoOpReconcileEntry extends ReconcileEntry {
  reason: 'no-op';
  /** Target value (same as current) */
  value: boolean | number;
}

/**
 * Entry for failed device operations.
 */
export interface FailedReconcileEntry extends ReconcileEntry {
  reason: 'error';
  /** Error message from the operation */
  message: string;
}

/**
 * Discriminated union of all reconcile entry types.
 * Use the `reason` field to narrow the type.
 */
export type TypedReconcileEntry =
  | AppliedReconcileEntry
  | SkippedReconcileEntry
  | NoOpReconcileEntry
  | FailedReconcileEntry;

/**
 * Complete result from a reconcile operation.
 *
 * This structured result enables diagnostic inspection of why devices
 * were or were not touched during the most recent reconcile call.
 */
export interface ReconcileResult {
  /** Devices successfully updated to target state */
  applied: AppliedReconcileEntry[];
  /** Devices skipped due to manual override detection */
  skipped: SkippedReconcileEntry[];
  /** Devices that failed to update */
  failed: FailedReconcileEntry[];
  /** Devices already in target state (no change needed) */
  noOp: NoOpReconcileEntry[];
  /** The phase being reconciled */
  phase: Phase;
  /** Reconciliation mode: 'transition' for phase changes, 'maintenance' for periodic checks */
  mode: 'transition' | 'maintenance';
  /** Timestamp of this reconcile operation */
  timestamp: Date;
}

/**
 * Tracks the last known app-set state for drift detection.
 *
 * Used to detect manual overrides by comparing current device state
 * against what the app last commanded.
 */
export interface DeviceStateTracking {
  /** Device identifier */
  deviceId: string;
  /** Capability being tracked */
  capability: Capability;
  /** Last value this app set (undefined means never set by app) */
  lastSetValue?: boolean | number;
  /** When this value was last set */
  lastSetAt?: Date;
}
