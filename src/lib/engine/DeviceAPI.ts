/**
 * DeviceAPI - Abstract interface for device interactions
 *
 * This interface abstracts Homey (or other) device operations so the Reconciler
 * can be fully tested with mocks without depending on the Homey SDK.
 */

/**
 * Current state of a device, containing only capabilities the Reconciler cares about.
 */
export interface DeviceState {
  /** On/off state of the device */
  onoff?: boolean;
  /** Dim level (0-1) for dimmable devices */
  dim?: number;
}

/**
 * Capability names the Reconciler interacts with.
 */
export type Capability = 'onoff' | 'dim';

/**
 * Value types mapped to capabilities for type safety.
 */
export type CapabilityValue<T extends Capability> = T extends 'onoff'
  ? boolean
  : T extends 'dim'
    ? number
    : never;

/**
 * DeviceAPI provides platform-agnostic device operations.
 *
 * Implementations wrap the Homey SDK or provide mock/test doubles.
 */
export interface DeviceAPI {
  /**
   * Get the current state of a device.
   *
   * @param deviceId - Unique identifier for the device
   * @returns Promise resolving to the device's current state
   */
  getState(deviceId: string): Promise<DeviceState>;

  /**
   * Set a capability value on a device.
   *
   * @param deviceId - Unique identifier for the device
   * @param capability - The capability to set ('onoff' or 'dim')
   * @param value - The value to set (boolean for onoff, number for dim)
   * @returns Promise resolving when the operation completes
   */
  setCapability<T extends Capability>(
    deviceId: string,
    capability: T,
    value: CapabilityValue<T>
  ): Promise<void>;
}

/**
 * Maps role IDs to arrays of device IDs that fulfill that role.
 *
 * Example: { 'living-room-main': ['device-abc', 'device-def'] }
 */
export type RoleDeviceMapping = Record<string /* roleId */, string[] /* deviceIds */>;