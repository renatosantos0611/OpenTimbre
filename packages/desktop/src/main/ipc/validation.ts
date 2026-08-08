/**
 * Runtime payload validation for renderer-originated channels. Functional
 * handlers compose these schemas in later tasks before touching domain code.
 */
import { z } from 'zod'

const schemas = {
  'chat:send': z.string().trim().min(1),
  'rig:apply': z.string().trim().min(1),
  'plugin:state': z.string().trim().min(1),
  'plugin:open': z.string().trim().min(1),
  'plugin:installMapping': z.string().trim().min(1),
  'window:setLocale': z.enum(['en', 'pt']),
  'window:setTheme': z.enum(['system', 'light', 'dark']),
  'keys:remove': z.enum(['anthropic', 'openai']),
  'keys:save': z.tuple([z.enum(['anthropic', 'openai']), z.string().min(1)]),
  'config:guitar': z.enum(['stratocaster', 'les_paul', 'custom']),
} as const

export type ValidatedChannel = keyof typeof schemas

export function validatePayload(channel: ValidatedChannel, payload: unknown): unknown {
  return schemas[channel].parse(payload)
}

export function isValidatedChannel(channel: string): channel is ValidatedChannel {
  return channel in schemas
}
