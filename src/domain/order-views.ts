import type { FulfillmentOrder } from '../types'

export type OrderView = 'queue' | 'returns'
export type QueueFilter = 'all' | 'priority' | 'working'

type OrderViewInput = {
  orders: FulfillmentOrder[]
  returns: FulfillmentOrder[]
  query: string
  view: OrderView
  queueFilter: QueueFilter
}

export function deriveOrderViews({ orders, returns, query, view, queueFilter }: OrderViewInput) {
  const queueOrders = orders.filter((order) => order.status !== 'returned')
  const priorityOrders = queueOrders.filter((order) => order.priority !== 'standard')
  const workingOrders = queueOrders.filter((order) => ['allocated', 'picking', 'picked'].includes(order.status))
  const normalizedQuery = query.trim().toLowerCase()
  const visibleReturns = returns.filter((order) => {
    if (!normalizedQuery) return true
    const searchable = [order.orderNumber, order.zone, ...order.items.map((item) => item.name)].join(' ').toLowerCase()
    return searchable.includes(normalizedQuery)
  })
  const visibleQueue =
    queueFilter === 'priority' ? priorityOrders : queueFilter === 'working' ? workingOrders : queueOrders

  return {
    queueOrders,
    priorityOrders,
    workingOrders,
    visibleOrders: view === 'returns' ? visibleReturns : visibleQueue,
  }
}
