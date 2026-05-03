import { z } from 'zod';

export const RoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  devices: z.array(z.string()).optional(),
});
export type Role = z.infer<typeof RoleSchema>;

export const PhaseSchema = z.enum(['NIGHT', 'MORNING', 'DAY', 'EVENING']);
export type Phase = z.infer<typeof PhaseSchema>;

export const TimeConditionSchema = z.object({
  type: z.literal('time'),
  at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
});
export type TimeCondition = z.infer<typeof TimeConditionSchema>;

export const SolarConditionSchema = z.object({
  type: z.literal('solar'),
  event: z.enum(['sunrise', 'sunset', 'goldenHour', 'goldenHourEnd']),
  offsetMinutes: z.number().int()
});
export type SolarCondition = z.infer<typeof SolarConditionSchema>;

export const LuxConditionSchema = z.object({
  type: z.literal('lux'),
  operator: z.enum(['lt', 'gt']),
  value: z.number().nonnegative()
});
export type LuxCondition = z.infer<typeof LuxConditionSchema>;

export const ConditionSchema = z.discriminatedUnion('type', [
  TimeConditionSchema,
  SolarConditionSchema,
  LuxConditionSchema
]);
export type Condition = z.infer<typeof ConditionSchema>;

export const PhaseScheduleSchema = z.object({
  conditions: z.array(ConditionSchema).min(1)
});
export type PhaseSchedule = z.infer<typeof PhaseScheduleSchema>;

export const DimmingConfigSchema = z.object({
  source: z.enum(['indoor_downstairs', 'indoor_upstairs']),
  brightLux: z.number(),
  darkLux: z.number(),
  brightDim: z.number().min(0).max(1),
  darkDim: z.number().min(0).max(1),
});
export type DimmingConfig = z.infer<typeof DimmingConfigSchema>;

export const RoleStateSchema = z.object({
  onoff: z.boolean(),
  dim: z.number().min(0).max(1).optional(),
  dimming: DimmingConfigSchema.optional(),
});
export type RoleState = z.infer<typeof RoleStateSchema>;

export const PhaseConfigSchema = z.object({
  weekday: PhaseScheduleSchema,
  weekend: PhaseScheduleSchema,
  states: z.record(z.string(), RoleStateSchema)
});
export type PhaseConfig = z.infer<typeof PhaseConfigSchema>;

export const SensorsSchema = z.object({
  outdoor: z.string().optional(),
  indoor_downstairs: z.string().optional(),
  indoor_upstairs: z.string().optional(),
}).optional();
export type SensorsConfig = z.infer<typeof SensorsSchema>;

export const AppConfigSchema = z.object({
  version: z.string().min(1),
  roles: z.array(RoleSchema),
  phases: z.object({
    NIGHT: PhaseConfigSchema,
    MORNING: PhaseConfigSchema,
    DAY: PhaseConfigSchema,
    EVENING: PhaseConfigSchema
  }),
  sensors: SensorsSchema
});
export type AppConfig = z.infer<typeof AppConfigSchema>;
