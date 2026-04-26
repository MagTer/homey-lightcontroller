import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/lib/version.js';

describe('smoke test', () => {
    it('should pass a basic assertion', () => {
        expect(1 + 1).toBe(2);
    });

    it('should resolve imports from src', () => {
        expect(VERSION).toBe("1.0.0");
    });
});
