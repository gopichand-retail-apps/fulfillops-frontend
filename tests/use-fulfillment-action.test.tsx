import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentProvider } from '../src/content'
import type { FulfillmentOrder } from '../src/types'
import { useFulfillmentAction } from '../src/hooks/use-fulfillment-action'
import { defaultContentModel } from './test-utils'

const order: FulfillmentOrder = {
  id: 'FO-1',
  orderNumber: 'FO-1',
  status: 'accepted',
  priority: 'standard',
  channel: 'direct',
  zone: 'A-01',
  promisedAt: '2026-11-01T14:00:00.000Z',
  createdAt: '2026-11-01T12:00:00.000Z',
  items: [],
  allocation: null,
  package: null,
  shipment: null,
  returnInfo: null,
  events: [],
  version: 1,
}

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data, requestId: 'action-test-request' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(code: string, status: number): Response {
  return new Response(JSON.stringify({ code, message: 'internal detail', requestId: 'action-error' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function contentResponse(): Response {
  return new Response(JSON.stringify(defaultContentModel), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const wrapper = ({ children }: PropsWithChildren) => (
  <ContentProvider appId="fulfillops" modelUrl="/fulfillops-model.json">
    {children}
  </ContentProvider>
)

describe('useFulfillmentAction', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing without a selected order', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(contentResponse())
    vi.stubGlobal('fetch', fetchMock)
    const refreshData = vi.fn()
    const { result } = renderHook(() => useFulfillmentAction({ order: null, refreshData }), { wrapper })

    await waitFor(() => expect(result.current).not.toBeNull())
    await act(async () => result.current.runAction({ action: 'allocate' }))
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(refreshData).not.toHaveBeenCalled()
    expect(result.current.notice).toBeNull()
  })

  it('records successful actions and refreshes server-owned data', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(contentResponse())
      .mockResolvedValueOnce(
        response({ order: { ...order, status: 'allocated' }, message: 'Allocated', replayed: false }, 201),
      )
    vi.stubGlobal('fetch', fetchMock)
    const refreshData = vi.fn()
    const { result } = renderHook(() => useFulfillmentAction({ order, refreshData }), { wrapper })

    await waitFor(() => {
      expect(document.title).toBe('FulfillOps | Warehouse operations')
      expect(result.current).not.toBeNull()
    })
    await act(async () => result.current.runAction({ action: 'allocate' }))

    await waitFor(() =>
      expect(result.current.notice).toEqual({ tone: 'success', message: 'Inventory allocated to this order.' }),
    )
    expect(refreshData).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('maps rejected actions to safe model errors and refreshes state', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(contentResponse())
      .mockResolvedValueOnce(errorResponse('ROLE_NOT_ALLOWED', 403))
    vi.stubGlobal('fetch', fetchMock)
    const refreshData = vi.fn()
    const { result } = renderHook(() => useFulfillmentAction({ order, refreshData }), { wrapper })

    await waitFor(() => {
      expect(document.title).toBe('FulfillOps | Warehouse operations')
      expect(result.current).not.toBeNull()
    })
    await act(async () => result.current.runAction({ action: 'allocate' }))
    await waitFor(() =>
      expect(result.current.notice).toEqual({
        tone: 'error',
        message: 'This action is not available for the selected warehouse role.',
      }),
    )
    expect(refreshData).toHaveBeenCalledOnce()
  })
})
