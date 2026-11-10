import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import OrderDetail from '../src/components/OrderDetail'
import type { FulfillmentOrder } from '../src/types'
import { renderWithContent } from './test-utils'

function makeOrder(status: FulfillmentOrder['status']): FulfillmentOrder {
  const shipped = status === 'shipped' || status === 'returned'
  return {
    id: 'FO-1',
    orderNumber: 'FO-1',
    status,
    priority: 'standard',
    channel: 'direct',
    zone: 'A-01',
    promisedAt: '2026-11-01T14:00:00.000Z',
    createdAt: '2026-11-01T12:00:00.000Z',
    items: [],
    allocation: null,
    package: null,
    shipment: shipped
      ? {
          carrier: 'ParcelPilot',
          trackingNumber: 'SIM-FO1-01',
          shippedAt: '2026-11-01T13:00:00.000Z',
        }
      : null,
    returnInfo: status === 'returned' ? { reason: 'wrong_item', createdAt: '2026-11-01T13:30:00.000Z' } : null,
    events: [],
    version: 3,
  }
}

describe('OrderDetail', () => {
  it('renders the order and back action in desktop layout', async () => {
    const onBack = vi.fn()
    renderWithContent(
      <OrderDetail
        order={makeOrder('accepted')}
        now={Date.parse('2026-11-01T13:00:00.000Z')}
        role="picker"
        pendingAction={null}
        mobileOpen={false}
        onBack={onBack}
        onAction={vi.fn()}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'FO-1' })).toBeVisible()
    expect(document.querySelector('.shipment-reference')).toBeNull()
    const back = screen.getByRole('button', { name: 'Back to order queue' })
    fireEvent.click(back)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows shipment data and the mobile-visible panel for shipped orders', async () => {
    renderWithContent(
      <OrderDetail
        order={makeOrder('shipped')}
        now={Date.parse('2026-11-01T13:00:00.000Z')}
        role="warehouse_manager"
        pendingAction={null}
        mobileOpen
        onBack={vi.fn()}
        onAction={vi.fn()}
      />,
    )

    await screen.findByRole('heading', { name: 'FO-1' })
    expect(document.querySelector('.detail-panel')?.className).toContain('mobile-visible')
    expect(screen.getByText('SIM-FO1-01')).toBeVisible()
  })
})
