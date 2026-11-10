import { describe, expect, it } from 'vitest'
import { deriveOrderViews } from '../src/domain/order-views'
import type { FulfillmentOrder } from '../src/types'

function order(
  id: string,
  status: FulfillmentOrder['status'],
  priority: FulfillmentOrder['priority'],
  itemName: string,
): FulfillmentOrder {
  return {
    id,
    orderNumber: id,
    status,
    priority,
    channel: 'direct',
    zone: 'A-03',
    promisedAt: '2026-11-01T14:00:00.000Z',
    createdAt: '2026-11-01T12:00:00.000Z',
    items: [
      {
        sku: id,
        name: itemName,
        location: 'A-03-01',
        orderedQuantity: 1,
        pickedQuantity: 0,
      },
    ],
    allocation: null,
    package: null,
    shipment: null,
    returnInfo: null,
    events: [],
    version: 1,
  }
}

describe('deriveOrderViews', () => {
  const orders = [
    order('FO-1', 'accepted', 'expedite', 'Headphones'),
    order('FO-2', 'allocated', 'standard', 'Cable'),
    order('FO-3', 'shipped', 'high', 'Lamp'),
    order('FO-4', 'returned', 'standard', 'Mug'),
  ]
  const returnedOrder = orders.find((entry) => entry.status === 'returned')
  if (!returnedOrder) throw new Error('Expected a seeded returned order.')
  const returns = [returnedOrder]

  it('derives all, priority, and working queues without returned orders', () => {
    const all = deriveOrderViews({ orders, returns, query: '', view: 'queue', queueFilter: 'all' })
    expect(all.queueOrders.map((entry) => entry.id)).toEqual(['FO-1', 'FO-2', 'FO-3'])
    expect(all.visibleOrders).toEqual(all.queueOrders)

    const priority = deriveOrderViews({
      orders,
      returns,
      query: '',
      view: 'queue',
      queueFilter: 'priority',
    })
    expect(priority.visibleOrders.map((entry) => entry.id)).toEqual(['FO-1', 'FO-3'])

    const working = deriveOrderViews({
      orders,
      returns,
      query: '',
      view: 'queue',
      queueFilter: 'working',
    })
    expect(working.visibleOrders.map((entry) => entry.id)).toEqual(['FO-2'])
  })

  it('filters return rows by order, zone, or item text', () => {
    const allReturns = deriveOrderViews({
      orders,
      returns,
      query: '',
      view: 'returns',
      queueFilter: 'all',
    })
    expect(allReturns.visibleOrders).toEqual(returns)

    const matchesItem = deriveOrderViews({
      orders,
      returns,
      query: 'mug',
      view: 'returns',
      queueFilter: 'all',
    })
    expect(matchesItem.visibleOrders.map((entry) => entry.id)).toEqual(['FO-4'])

    const noMatches = deriveOrderViews({
      orders,
      returns,
      query: 'unknown',
      view: 'returns',
      queueFilter: 'all',
    })
    expect(noMatches.visibleOrders).toEqual([])
  })
})
