import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '../src/api'
import type { OrderActionInput } from '../src/api'
import { createActionIntent, isOutcomeUnknown, isSamePayload } from '../src/domain/action-intent'

const pickOne: OrderActionInput = { action: 'pick', sku: 'AUR-220', quantity: 1 }

describe('action intent', () => {
  it('creates a distinct key for each confirmed intent and freezes the order version', () => {
    const first = createActionIntent('FO-1', pickOne, 3)
    const second = createActionIntent('FO-1', pickOne, 3)

    expect(first.key).not.toBe(second.key)
    expect(first.key).toMatch(/^[0-9a-f-]{36}$/i)
    expect(first).toMatchObject({ orderId: 'FO-1', version: 3, input: pickOne })
  })

  it('keeps its own copy of the input', () => {
    const input: OrderActionInput = { action: 'pick', sku: 'AUR-220', quantity: 1 }
    const intent = createActionIntent('FO-1', input, 1)
    input.quantity = 2

    expect(intent.input.quantity).toBe(1)
  })

  it('treats the same order and input as the same payload whatever the current order version', () => {
    const intent = createActionIntent('FO-1', pickOne, 3)

    expect(isSamePayload(intent, 'FO-1', { action: 'pick', sku: 'AUR-220', quantity: 1 })).toBe(true)
  })

  it.each<[string, string, OrderActionInput]>([
    ['order', 'FO-2', pickOne],
    ['action', 'FO-1', { action: 'pack' }],
    ['SKU', 'FO-1', { ...pickOne, sku: 'CAB-118' }],
    ['quantity', 'FO-1', { ...pickOne, quantity: 2 }],
  ])('sees a changed %s as a new payload', (_field, orderId, input) => {
    expect(isSamePayload(createActionIntent('FO-1', pickOne, 3), orderId, input)).toBe(false)
  })

  it('sees a changed return reason as a new payload', () => {
    const intent = createActionIntent('FO-1', { action: 'return', reason: 'damaged' }, 5)

    expect(isSamePayload(intent, 'FO-1', { action: 'return', reason: 'wrong_item' })).toBe(false)
    expect(isSamePayload(intent, 'FO-1', { action: 'return', reason: 'damaged' })).toBe(true)
  })

  it.each<[string, unknown, boolean]>([
    ['a network failure', new TypeError('Failed to fetch'), true],
    ['a timeout', new ApiRequestError('REQUEST_TIMEOUT'), true],
    ['a coded 500', new ApiRequestError('INTERNAL_ERROR', 500), true],
    ['an uncoded 503', new ApiRequestError('REQUEST_FAILED', 503), true],
    ['an unreadable 201 envelope', new ApiRequestError('INVALID_RESPONSE', 201), true],
    ['an unreadable 200 result', new ApiRequestError('INVALID_CONTENT', 200), true],
    ['a stale order', new ApiRequestError('STALE_ORDER', 409), false],
    ['an invalid transition', new ApiRequestError('INVALID_TRANSITION', 409), false],
    ['a role denial', new ApiRequestError('ROLE_NOT_ALLOWED', 403), false],
    ['a rate limit', new ApiRequestError('REQUEST_FAILED', 429), false],
    ['an uncoded 400', new ApiRequestError('REQUEST_FAILED', 400), false],
    ['an unrelated error', new Error('boom'), false],
    ['a non-error value', 'boom', false],
  ])('classifies %s as unknown outcome: %s', (_label, error, expected) => {
    expect(isOutcomeUnknown(error)).toBe(expected)
  })
})
