import { z } from 'zod';
import { AppConfigSchema, type AppConfig } from './Config.js';

export class ConfigValidationError extends Error {
  readonly issues: z.ZodIssue[];
  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

export function parseConfig(raw: unknown): AppConfig {
  const result = AppConfigSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map(i => `${i.path.join('.') || 'root'}: ${i.message}`)
      .join('; ');
    throw new ConfigValidationError(message, result.error.issues);
  }
  return result.data;
}

export function safeParseConfig(raw: unknown):
  | { ok: true; config: AppConfig }
  | { ok: false; error: ConfigValidationError } {
  try {
    return { ok: true, config: parseConfig(raw) };
  } catch (e) {
    if (e instanceof ConfigValidationError) {
      return { ok: false, error: e };
    }
    throw e;
  }
}

export type { AppConfig } from './Config.js';
