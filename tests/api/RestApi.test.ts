import { describe, it, expect, vi, beforeEach } from 'vitest';
import putPhaseHandler from '../../src/api.js';

// The putPhase handler is the default export's putPhase method.
// We import the whole module and call putPhase directly.
import api from '../../src/api.js';

describe('REST API — putPhase handler', () => {
  let mockForcePhase: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockForcePhase = vi.fn();
  });

  function makeHomey(overrides: { forcePhase?: ReturnType<typeof vi.fn>; appForcePhaseReturn?: string } = {}) {
    const { forcePhase = mockForcePhase, appForcePhaseReturn = 'DAY' } = overrides;
    forcePhase.mockReturnValue(appForcePhaseReturn);
    return {
      app: {
        forcePhase,
      },
    };
  }

  describe('valid phase string', () => {
    it('delegates to app.forcePhase with the same string and returns ok:true with phase', async () => {
      const homey = makeHomey({ appForcePhaseReturn: 'EVENING' });

      const result = await (api as any).putPhase({ homey, body: { phase: 'EVENING' } });

      expect(result).toEqual({ ok: true, phase: 'EVENING' });
      expect(mockForcePhase).toHaveBeenCalledOnce();
      expect(mockForcePhase).toHaveBeenCalledWith('EVENING');
    });

    it('returns the phase that forcePhase resolves to (not the raw input)', async () => {
      // PhaseSchema.normalizedEnum might transform input; the handler returns what forcePhase returns
      const homey = makeHomey({ forcePhase: mockForcePhase, appForcePhaseReturn: 'NIGHT' });

      const result = await (api as any).putPhase({ homey, body: { phase: 'NIGHT' } });

      expect(result).toEqual({ ok: true, phase: 'NIGHT' });
    });
  });

  describe('forcePhase throws (simulating Zod rejection of invalid phase)', () => {
    it('re-throws the error so it propagates to the caller', async () => {
      const homey = makeHomey();
      const zodError = new Error('Invalid phase');
      mockForcePhase.mockImplementation(() => {
        throw zodError;
      });

      await expect((api as any).putPhase({ homey, body: { phase: 'INVALID' } })).rejects.toThrow(zodError);
    });
  });

  describe('missing body / missing body.phase', () => {
    it('calls app.forcePhase with undefined when body is absent', async () => {
      const homey = makeHomey();

      await (api as any).putPhase({ homey, body: undefined });

      expect(mockForcePhase).toHaveBeenCalledOnce();
      expect(mockForcePhase).toHaveBeenCalledWith(undefined);
    });

    it('calls app.forcePhase with undefined when body.phase is absent', async () => {
      const homey = makeHomey();

      await (api as any).putPhase({ homey, body: {} });

      expect(mockForcePhase).toHaveBeenCalledOnce();
      expect(mockForcePhase).toHaveBeenCalledWith(undefined);
    });
  });
});
