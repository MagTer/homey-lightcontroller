/**
 * Homey API handlers — loosely typed to match Homey SDK v3 ESM patterns.
 * Do NOT log the owner API token; it is sensitive.
 */
export default {
  async getConfig({ homey }: { homey: any }) {
    homey.app.log('api:getConfig called');
    try {
      const config = homey.app.getConfig();
      homey.app.log('api:getConfig ok', { hasConfig: config !== null });
      return config;
    } catch (err: any) {
      homey.app.error('api:getConfig error', { message: err?.message });
      throw err;
    }
  },

  async saveConfig({ homey, body }: { homey: any; body?: unknown }) {
    homey.app.log('api:saveConfig called');
    const result = await homey.app.saveConfig(body);
    return { ok: true, version: result.version };
  },

  async putPhase({ homey, body }: { homey: any; body?: any }) {
    const phase = homey.app.forcePhase(body?.phase);
    return { ok: true, phase };
  },

  async getStatus({ homey }: { homey: any }) {
    homey.app.log('api:getStatus called');
    try {
      const status = homey.app.getStatus();
      return status;
    } catch (err: any) {
      homey.app.error('api:getStatus error', { message: err?.message });
      throw err;
    }
  },

  async getDevices({ homey }: { homey: any }) {
    homey.app.log('api:getDevices called');
    try {
      // ManagerApi.get() requires a session, which doesn't exist in app API handlers.
      // We use the owner token to fetch devices directly from the local REST API.
      const [token, localUrl] = await Promise.all([
        homey.api.getOwnerApiToken(),
        homey.api.getLocalUrl(),
      ]);

      const res = await fetch(`${localUrl}/api/manager/devices/device`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Device API error: ${res.status}`);

      const allDevices: Record<string, any> = await res.json();
      const devices = Object.values(allDevices)
        .filter((d: any) =>
          Array.isArray(d.capabilities) &&
          (d.capabilities.includes('onoff') || d.capabilities.includes('measure_luminance'))
        )
        .map((d: any) => ({
          id: d.id,
          name: d.name,
          capabilities: d.capabilities,
          zoneName: d.zoneName || '',
        }));

      homey.app.log('api:getDevices ok', { count: devices.length });
      return devices;
    } catch (err: any) {
      homey.app.error('api:getDevices error', { message: err?.message, stack: err?.stack });
      throw err;
    }
  },
};
