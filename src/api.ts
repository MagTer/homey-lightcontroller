/**
 * Homey API handlers — loosely typed to match Homey SDK v3 ESM patterns.
 * Do NOT log the owner API token; it is sensitive.
 */
export default {
  async getConfig({ homey }: { homey: any }) {
    return homey.app.getConfig();
  },

  async saveConfig({ homey, body }: { homey: any; body?: unknown }) {
    const result = await homey.app.saveConfig(body);
    return { ok: true, version: result.version };
  },

  async putPhase({ homey, body }: { homey: any; body?: any }) {
    const phase = homey.app.forcePhase(body?.phase);
    return { ok: true, phase };
  },

  async getDevices({ homey }: { homey: any }) {
    const [token, localUrl] = await Promise.all([
      homey.api.getOwnerApiToken(),
      homey.api.getLocalUrl(),
    ]);
    // Do NOT log the token — it is sensitive.
    return { token, localUrl };
  },
};
