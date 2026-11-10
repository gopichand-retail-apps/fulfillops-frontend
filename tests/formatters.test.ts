import { describe, expect, it } from 'vitest'
import { channelLabel, formatDeadline, formatTime, orderUnitCount, returnReasonLabel } from '../src/formatters'
import type { FulfillmentOrder } from '../src/types'

const order: FulfillmentOrder = {
  id: 'FO-1',
  orderNumber: 'FO-1',
  status: 'accepted',
  priority: 'standard',
  channel: 'marketplace',
  zone: 'A-03',
  promisedAt: '2026-11-01T14:00:00.000Z',
  createdAt: '2026-11-01T12:00:00.000Z',
  items: [
    { sku: 'A', name: 'Item A', location: 'A-01', orderedQuantity: 2, pickedQuantity: 0 },
    { sku: 'B', name: 'Item B', location: 'A-02', orderedQuantity: 1, pickedQuantity: 1 },
  ],
  allocation: null,
  package: null,
  shipment: null,
  returnInfo: null,
  events: [],
  version: 1,
}

const translate = (key: string, values: Record<string, string | number> = {}) =>
  `${key}:${Object.values(values).join(',')}`

describe('FulfillOps formatters', () => {
  it('formats late, under-hour, and multi-hour deadlines', () => {
    const now = Date.parse('2026-11-01T13:00:00.000Z')

    expect(formatDeadline('2026-11-01T12:30:00.000Z', translate, now)).toBe('time.late:30')
    expect(formatDeadline('2026-11-01T13:45:00.000Z', translate, now)).toBe('time.minutesLeft:45')
    expect(formatDeadline('2026-11-01T15:15:00.000Z', translate, now)).toBe('time.hoursMinutesLeft:2,15')
  })

  it('formats timestamps using locale and maps order fields', () => {
    expect(formatTime('2026-11-01T14:05:00.000Z', 'en-US')).toMatch(/\d{1,2}:05/)
    expect(orderUnitCount(order)).toBe(3)
    expect(orderUnitCount({ ...order, items: [] })).toBe(0)
    expect(channelLabel(order.channel, translate)).toBe('channel.marketplace:')
    expect(returnReasonLabel('wrong_item', translate)).toBe('returnReason.wrong_item:')
  })
})
