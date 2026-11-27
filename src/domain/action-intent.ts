import { ApiRequestError } from '../api'
import type { OrderActionInput } from '../api'

/**
 * One confirmed warehouse write. The key and the order version are fixed when the user confirms, so a retry
 * after a lost reply is the same request and the server can replay its result instead of applying it twice.
 * Held in memory only (decision D-11); never written to browser storage.
 */
export type ActionIntent = {
  key: string
  orderId: string
  input: OrderActionInput
  version: number
}

const unreadableReplyCodes = new Set(['REQUEST_TIMEOUT', 'INVALID_RESPONSE', 'INVALID_CONTENT'])

export function createActionIntent(orderId: string, input: OrderActionInput, version: number): ActionIntent {
  return { key: crypto.randomUUID(), orderId, input: { ...input }, version }
}

/** Same order and same user-chosen payload. The order version is not part of the payload. */
export function isSamePayload(intent: ActionIntent, orderId: string, input: OrderActionInput): boolean {
  const { input: kept } = intent
  return (
    intent.orderId === orderId &&
    kept.action === input.action &&
    kept.sku === input.sku &&
    kept.quantity === input.quantity &&
    kept.reason === input.reason
  )
}

/** True when the write may or may not have been applied, so the intent must be kept for a safe retry. */
export function isOutcomeUnknown(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (!(error instanceof ApiRequestError)) return false
  if (unreadableReplyCodes.has(error.code)) return true
  return error.status !== undefined && error.status >= 500
}
