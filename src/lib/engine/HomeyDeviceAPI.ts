/**
 * HomeyDeviceAPI - Concrete DeviceAPI implementation for Homey SDK v3
 *
 * Wraps Homey's device manager to provide getState/setCapability operations
 * that the Reconciler can call.
 */

import type { DeviceAPI, DeviceState, Capability, CapabilityValue } from './DeviceAPI.js';

export class HomeyDeviceAPI implements DeviceAPI {
  constructor(private homey: any) {}

  async getState(deviceId: string): Promise<DeviceState> {
    const device = await this.homey.api.devices.getDevice({ id: deviceId });
    return {
      onoff: device.capabilitiesObj?.onoff?.value ?? false,
      dim: device.capabilitiesObj?.dim?.value,
    };
  }

  async setCapability<T extends Capability>(
    deviceId: string,
    capability: T,
    value: CapabilityValue<T>
  ): Promise<void> {
    const device = await this.homey.api.devices.getDevice({ id: deviceId });
    await device.setCapabilityValue(capability, value);
  }
}
