---
estimated_steps: 44
estimated_files: 1
skills_used: []
---

# T03: Implement parseConfig and safeParseConfig in ConfigParser.ts

Replace the empty file `src/lib/config/ConfigParser.ts` with a pure validation wrapper around `AppConfigSchema` from `./Config.js`. No I/O, no logging, no side effects.

Steps (do them in this order):

1. Add imports at the top:
   - `import { z } from 'zod';`
   - `import { AppConfigSchema, type AppConfig } from './Config.js';`  (NodeNext ESM requires the `.js` extension on relative imports — even though the source file is `.ts`).

2. Define the domain error class:
   ```
   export class ConfigValidationError extends Error {
     readonly issues: z.ZodIssue[];
     constructor(message: string, issues: z.ZodIssue[]) {
       super(message);
       this.name = 'ConfigValidationError';
       this.issues = issues;
     }
   }
   ```

3. Add the throwing parser:
   ```
   export function parseConfig(raw: unknown): AppConfig {
     const result = AppConfigSchema.safeParse(raw);
     if (!result.success) {
       const message = result.error.issues
         .map(i => `${i.path.join('.') || '<root>'}: ${i.message}`)
         .join('; ');
       throw new ConfigValidationError(message, result.error.issues);
     }
     return result.data;
   }
   ```

4. Add the non-throwing variant:
   ```
   export function safeParseConfig(raw: unknown):
     | { ok: true; config: AppConfig }
     | { ok: false; error: ConfigValidationError } {
     try {
       return { ok: true, config: parseConfig(raw) };
     } catch (e) {
       if (e instanceof ConfigValidationError) return { ok: false, error: e };
       throw e;
     }
   }
   ```

5. Re-export the AppConfig type for caller convenience: `export type { AppConfig } from './Config.js';`

Do NOT write tests in this task — T04 owns the test file.

## Inputs

- ``src/lib/config/Config.ts``
- ``src/lib/config/ConfigParser.ts``

## Expected Output

- ``src/lib/config/ConfigParser.ts``

## Verification

Run `npx tsc --noEmit` from the project root and confirm zero errors. Then confirm the exports exist: `grep -q "export class ConfigValidationError" src/lib/config/ConfigParser.ts`, `grep -q "export function parseConfig" src/lib/config/ConfigParser.ts`, `grep -q "export function safeParseConfig" src/lib/config/ConfigParser.ts` all return success.
