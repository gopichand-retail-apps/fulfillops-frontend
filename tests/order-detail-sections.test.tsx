import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrderActionPanel, OrderItems, OrderProgress } from '../src/components/OrderDetailSections'
import type { FulfillmentOrder } from '../src/types'
import { renderWithContent } from './test-utils'

function makeOrder(status: FulfillmentOrder['status']): FulfillmentOrder {
  const isReturned = status === 'returned'
  return {
    id: 'FO-48291',
    orderNumber: 'FO-48291',
    status,
    priority: 'expedite',
    channel: 'direct',
    zone: 'A-03',
    promisedAt: '2026-11-01T14:00:00.000Z',
    createdAt: '2026-11-01T12:00:00.000Z',
    items: [
      { sku: 'AUR-220', name: 'Headphones', location: 'A-03-14', orderedQuantity: 2, pickedQuantity: 1 },
      { sku: 'CAB-118', name: 'Cable', location: 'A-03-18', orderedQuantity: 1, pickedQuantity: 1 },
    ],
    allocation: null,
    package: null,
    shipment: null,
    returnInfo: isReturned ? { reason: 'wrong_item', createdAt: '2026-11-01T13:00:00.000Z' } : null,
    events: [],
    version: 3,
  }
}

describe('Order detail workflow sections', () => {
  it('renders current workflow progress and the completed return summary', async () => {
    renderWithContent(<OrderProgress order={makeOrder('returned')} />)

    await screen.findByText('Order flow')
    expect(screen.getByText(/Return recorded/i)).toBeVisible()
    expect(screen.getByText(/Wrong item/i)).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('enables only incomplete pick lines for an authorized picker', async () => {
    const onAction = vi.fn()
    renderWithContent(
      <OrderItems order={makeOrder('picking')} role="picker" pendingAction={null} onAction={onAction} />,
    )

    await screen.findByText('Pick list')
    const pickButtons = screen.getAllByRole('button', { name: /Pick one/ })
    expect(pickButtons).toHaveLength(2)
    const incompletePick = pickButtons.at(0)
    if (!incompletePick) throw new Error('Expected an incomplete pick button.')
    expect(incompletePick).toBeEnabled()
    expect(pickButtons[1]).toBeDisabled()
    fireEvent.click(incompletePick)
    expect(onAction).toHaveBeenCalledWith({ action: 'pick', sku: 'AUR-220', quantity: 1 })
  })

  it('enforces role requirements and records a return reason', async () => {
    const onAction = vi.fn()
    renderWithContent(
      <OrderActionPanel
        order={makeOrder('shipped')}
        role="warehouse_manager"
        pendingAction={null}
        onAction={onAction}
      />,
    )

    await screen.findByText('Next action')
    fireEvent.click(screen.getByRole('button', { name: 'Start return' }))
    fireEvent.change(screen.getByLabelText('Return reason'), { target: { value: 'wrong_item' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record return' }))
    expect(onAction).toHaveBeenCalledWith({ action: 'return', reason: 'wrong_item' })
  })

  it('disables unauthorized actions and shows a completed-state panel', async () => {
    const onAction = vi.fn()
    renderWithContent(
      <OrderActionPanel order={makeOrder('accepted')} role="picker" pendingAction={null} onAction={onAction} />,
    )
    await screen.findByText('Next action')
    expect(screen.getByRole('button', { name: 'Allocate order' })).toBeDisabled()
    expect(screen.getByText('Switch role to warehouse manager to continue.')).toBeVisible()
    expect(onAction).not.toHaveBeenCalled()
  })

  it('shows a completed-state panel when no action remains', async () => {
    renderWithContent(
      <OrderActionPanel
        order={makeOrder('returned')}
        role="warehouse_manager"
        pendingAction={null}
        onAction={vi.fn()}
      />,
    )
    await screen.findByText('Next action')
    expect(screen.getByText('Return complete')).toBeVisible()
  })
})
