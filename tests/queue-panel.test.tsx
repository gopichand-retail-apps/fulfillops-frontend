import { fireEvent, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import QueuePanel from '../src/components/QueuePanel'
import type { FulfillmentOrder } from '../src/types'
import { renderWithContent } from './test-utils'

function makeOrder(
  id: string,
  status: FulfillmentOrder['status'],
  priority: FulfillmentOrder['priority'],
  name: string,
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
    items: [{ sku: id, name, location: 'A-03-01', orderedQuantity: 2, pickedQuantity: 0 }],
    allocation: null,
    package: null,
    shipment: null,
    returnInfo: null,
    events: [],
    version: 1,
  }
}

describe('QueuePanel', () => {
  const queueOrders = [
    makeOrder('FO-1', 'accepted', 'expedite', 'Headphones'),
    makeOrder('FO-2', 'allocated', 'standard', 'Cable'),
  ]
  const returnedOrder = makeOrder('FO-3', 'returned', 'standard', 'Mug')
  const onSearchChange = vi.fn()
  const onFilterChange = vi.fn()
  const onSelectOrder = vi.fn()

  function renderPanel(overrides: Partial<ComponentProps<typeof QueuePanel>> = {}) {
    const props: ComponentProps<typeof QueuePanel> = {
      view: 'queue',
      queueFilter: 'all',
      search: '',
      isLoading: false,
      now: Date.parse('2026-11-01T13:00:00.000Z'),
      visibleOrders: queueOrders,
      queueOrders,
      returns: [returnedOrder],
      priorityOrders: queueOrders.filter((entry) => entry.priority !== 'standard'),
      workingOrders: queueOrders.filter((entry) => entry.status === 'allocated'),
      selectedOrderId: 'FO-1',
      onSearchChange,
      onFilterChange,
      onSelectOrder,
      ...overrides,
    }
    return renderWithContent(<QueuePanel {...props} />)
  }

  it('renders rows and forwards search, filter, and selection changes', async () => {
    renderPanel()
    await screen.findByRole('heading', { name: 'Order queue' })

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'headphones' } })
    expect(onSearchChange).toHaveBeenCalledWith('headphones')
    const filterGroup = screen.getByRole('group', { name: 'Filter work queue' })
    fireEvent.click(within(filterGroup).getByRole('button', { name: /Priority/ }))
    expect(onFilterChange).toHaveBeenCalledWith('priority')
    fireEvent.click(within(filterGroup).getByRole('button', { name: /All/ }))
    expect(onFilterChange).toHaveBeenCalledWith('all')
    fireEvent.click(within(filterGroup).getByRole('button', { name: /In progress/ }))
    expect(onFilterChange).toHaveBeenCalledWith('working')
    fireEvent.click(screen.getByRole('button', { name: /FO-1/ }))
    expect(onSelectOrder).toHaveBeenCalledWith('FO-1')
    expect(screen.getAllByRole('button', { name: /FO-/ })).toHaveLength(2)
  })

  it('clears an entered search query', async () => {
    renderPanel({ search: 'headphones' })
    await screen.findByRole('heading', { name: 'Order queue' })

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearchChange).toHaveBeenCalledWith('')
  })

  it('shows loading and empty states', async () => {
    renderPanel({ isLoading: true, visibleOrders: [], queueOrders: [], selectedOrderId: null })
    await screen.findByRole('heading', { name: 'Order queue' })
    expect(screen.getByRole('status')).toBeVisible()
  })

  it('shows a no-results state after loading completes', async () => {
    renderPanel({ visibleOrders: [], queueOrders: [], selectedOrderId: null })
    await screen.findByRole('heading', { name: 'Order queue' })
    expect(screen.getByText('Try a different search or queue filter.')).toBeVisible()
  })

  it('lists returned orders in the returns view', async () => {
    renderPanel({
      view: 'returns',
      visibleOrders: [returnedOrder],
      queueOrders: [],
      selectedOrderId: returnedOrder.id,
    })
    await screen.findByRole('heading', { name: 'Returned orders' })
    expect(screen.getByRole('button', { name: /FO-3/ })).toBeVisible()
  })
})
