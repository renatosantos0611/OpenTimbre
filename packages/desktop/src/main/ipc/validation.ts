/**
 * Runtime payload validation for renderer-originated channels. Functional
 * handlers compose these schemas in later tasks before touching domain code.
 */
import { z } from 'zod'

const guitarSchema = z.object({
  model: z.string().min(1).max(200),
  pickups: z.enum(['single', 'humbucker', 'HSS', 'HSH', 'P90', 'other']),
  tuning: z.string().max(50),
  strings: z.number().int().min(4).max(12),
})

const schemas = {
  'chat:send': z.string().trim().min(1).max(4000),
  'conversations:open': z.string().trim().min(1),
  'conversations:delete': z.string().trim().min(1),
  'rig:apply': z.string().trim().min(1),
  'plugin:state': z.string().trim().min(1),
  'plugin:open': z.string().trim().min(1),
  'plugin:installMapping': z.string().trim().min(1),
  'window:setLocale': z.enum(['en', 'pt']),
  'window:setTheme': z.enum(['system', 'light', 'dark']),
  'window:dimOnUnfocus': z.boolean(),
  'window:autoApply': z.boolean(),
  'keys:remove': z.enum(['anthropic', 'openai']),
  'keys:save': z.tuple([z.enum(['anthropic', 'openai']), z.string().min(1).max(4000)]),
  'ai:model': z.tuple([z.enum(['anthropic', 'openai']), z.string().min(1).max(200)]),
  'ai:providerPreference': z.enum(['auto', 'anthropic', 'openai']),
  'config:guitar': guitarSchema,
} as const

export type ValidatedChannel = keyof typeof schemas

export function validatePayload(channel: ValidatedChannel, payload: unknown): unknown {
  return schemas[channel].parse(payload)
}

export function isValidatedChannel(channel: string): channel is ValidatedChannel {
  return channel in schemas
}
