import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import OrderDetail from '../src/components/OrderDetail'
import { ContentProvider } from '../src/content'
import type { FulfillmentOrder } from '../src/types'
import type { ReactElement } from 'react'
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

  function pickOrder(items: Array<[string, number, number]>, version: number): FulfillmentOrder {
    const allPicked = items.every(([, ordered, picked]) => picked === ordered)
    return {
      ...makeOrder(allPicked ? 'picked' : 'picking'),
      version,
      items: items.map(([sku, orderedQuantity, pickedQuantity]) => ({
        sku,
        name: sku,
        location: 'A-01-01',
        orderedQuantity,
        pickedQuantity,
      })),
    }
  }

  function detail(order: FulfillmentOrder, mobileOpen: boolean): ReactElement {
    return (
      <OrderDetail
        order={order}
        now={Date.parse('2026-11-01T13:00:00.000Z')}
        role="picker"
        pendingAction={null}
        mobileOpen={mobileOpen}
        onBack={vi.fn()}
        onAction={vi.fn()}
      />
    )
  }

  /** RTL's rerender replaces the whole tree, so keep the provider that renderWithContent added. */
  function withContent(element: ReactElement): ReactElement {
    return (
      <ContentProvider appId="fulfillops" modelUrl="/fulfillops-model.json">
        {element}
      </ContentProvider>
    )
  }

  it('moves focus to the order heading when the mobile detail opens', async () => {
    const order = makeOrder('accepted')
    const { rerender } = renderWithContent(detail(order, false))
    await screen.findByRole('heading', { name: 'FO-1' })

    rerender(withContent(detail(order, true)))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'FO-1' })).toHaveFocus())
  })

  it('moves focus to the next pick line, then to the next action, as lines complete', async () => {
    const first = pickOrder(
      [
        ['AUR-220', 1, 0],
        ['CAB-118', 1, 0],
      ],
      4,
    )
    const { rerender } = renderWithContent(detail(first, true))
    const buttons = await screen.findAllByRole('button', { name: /Pick one/ })
    buttons[0]?.focus()

    rerender(
      withContent(
        detail(
          pickOrder(
            [
              ['AUR-220', 1, 1],
              ['CAB-118', 1, 0],
            ],
            5,
          ),
          true,
        ),
      ),
    )
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Pick one/ })[1]).toHaveFocus())

    rerender(
      withContent(
        detail(
          pickOrder(
            [
              ['AUR-220', 1, 1],
              ['CAB-118', 1, 1],
            ],
            6,
          ),
          true,
        ),
      ),
    )
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Next action' })).toHaveFocus())
    expect(document.activeElement).not.toBe(document.body)
  })
})
