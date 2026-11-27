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

const pickingOrder: FulfillmentOrder = { ...order, status: 'allocated' }
const pickHeadphones = { action: 'pick', sku: 'AUR-220', quantity: 1 } as const
const recoveredMessage = 'Confirmed. This was already recorded and was not repeated.'

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

function workflowResult(replayed = false) {
  return response({ order: { ...pickingOrder, version: 2 }, message: 'Picked', replayed }, 201)
}

const wrapper = ({ children }: PropsWithChildren) => (
  <ContentProvider appId="fulfillops" modelUrl="/fulfillops-model.json">
    {children}
  </ContentProvider>
)

type HookProps = { order: FulfillmentOrder | null; refreshData: () => void }

function stubFetch(...replies: Array<Response | Error | Promise<Response>>) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(contentResponse())
  for (const reply of replies) {
    if (reply instanceof Error) fetchMock.mockRejectedValueOnce(reply)
    else fetchMock.mockReturnValueOnce(Promise.resolve(reply))
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function actionCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).includes('/actions'))
    .map(([url, init]) => {
      const headers = new Headers(init?.headers)
      return {
        url: String(url),
        key: headers.get('Idempotency-Key'),
        requestId: headers.get('X-Request-Id'),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      }
    })
}

async function renderActionHook(initialProps: HookProps) {
  const rendered = renderHook((props: HookProps) => useFulfillmentAction(props), { wrapper, initialProps })
  await waitFor(() => {
    expect(document.title).toBe('FulfillOps | Warehouse operations')
    expect(rendered.result.current).not.toBeNull()
  })
  return rendered
}

describe('useFulfillmentAction', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing without a selected order', async () => {
    const fetchMock = stubFetch()
    const refreshData = vi.fn()
    const { result } = await renderActionHook({ order: null, refreshData })

    await act(async () => result.current.runAction({ action: 'allocate' }))
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(refreshData).not.toHaveBeenCalled()
    expect(result.current.notice).toBeNull()
  })

  it('records successful actions and refreshes server-owned data', async () => {
    const fetchMock = stubFetch(
      response({ order: { ...order, status: 'allocated' }, message: 'Allocated', replayed: false }, 201),
    )
    const refreshData = vi.fn()
    const { result } = await renderActionHook({ order, refreshData })

    await act(async () => result.current.runAction({ action: 'allocate' }))

    await waitFor(() =>
      expect(result.current.notice).toEqual({ tone: 'success', message: 'Inventory allocated to this order.' }),
    )
    expect(refreshData).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.awaiting).toBeNull()
  })

  it('maps rejected actions to safe model errors and refreshes state', async () => {
    stubFetch(errorResponse('ROLE_NOT_ALLOWED', 403))
    const refreshData = vi.fn()
    const { result } = await renderActionHook({ order, refreshData })

    await act(async () => result.current.runAction({ action: 'allocate' }))
    await waitFor(() =>
      expect(result.current.notice).toEqual({
        tone: 'error',
        message: 'This action is not available for the selected warehouse role.',
      }),
    )
    expect(refreshData).toHaveBeenCalledOnce()
  })

  it('reuses one key and the frozen version when a lost reply is retried', async () => {
    const fetchMock = stubFetch(new TypeError('Failed to fetch'), workflowResult(true))
    const refreshData = vi.fn()
    const { result, rerender } = await renderActionHook({ order: pickingOrder, refreshData })

    await act(async () => result.current.runAction(pickHeadphones))
    expect(result.current.awaiting).toEqual({ orderId: 'FO-1', action: 'pick', sku: 'AUR-220' })
    rerender({ order: { ...pickingOrder, version: 2 }, refreshData })
    await act(async () => result.current.retryAwaiting())

    const [first, second] = actionCalls(fetchMock)
    expect(second?.key).toBe(first?.key)
    expect(second?.requestId).not.toBe(first?.requestId)
    expect(second?.body).toEqual({ ...pickHeadphones, version: 1 })
    expect(result.current.notice).toEqual({ tone: 'success', message: recoveredMessage })
    expect(result.current.awaiting).toBeNull()
    expect(refreshData).toHaveBeenCalledTimes(2)
  })

  it('treats the same action triggered again while awaiting as a retry of that intent', async () => {
    const fetchMock = stubFetch(new TypeError('Failed to fetch'), workflowResult(true))
    const refreshData = vi.fn()
    const { result, rerender } = await renderActionHook({ order: pickingOrder, refreshData })

    await act(async () => result.current.runAction(pickHeadphones))
    rerender({ order: { ...pickingOrder, version: 2 }, refreshData })
    await act(async () => result.current.runAction(pickHeadphones))

    const [first, second] = actionCalls(fetchMock)
    expect(second?.key).toBe(first?.key)
    expect(second?.body.version).toBe(1)
  })

  it('replaces the key when the payload changes', async () => {
    const fetchMock = stubFetch(new TypeError('Failed to fetch'), workflowResult())
    const refreshData = vi.fn()
    const { result, rerender } = await renderActionHook({ order: pickingOrder, refreshData })

    await act(async () => result.current.runAction(pickHeadphones))
    rerender({ order: { ...pickingOrder, version: 2 }, refreshData })
    await act(async () => result.current.runAction({ action: 'pick', sku: 'CAB-118', quantity: 1 }))

    const [first, second] = actionCalls(fetchMock)
    expect(second?.key).not.toBe(first?.key)
    expect(second?.body).toEqual({ action: 'pick', sku: 'CAB-118', quantity: 1, version: 2 })
    expect(result.current.awaiting).toBeNull()
  })

  it('discards the key after a confirmed result', async () => {
    const fetchMock = stubFetch(workflowResult(), workflowResult())
    const refreshData = vi.fn()
    const { result } = await renderActionHook({ order: pickingOrder, refreshData })

    await act(async () => result.current.runAction(pickHeadphones))
    await act(async () => result.current.runAction(pickHeadphones))
    await act(async () => result.current.retryAwaiting())

    const calls = actionCalls(fetchMock)
    expect(calls).toHaveLength(2)
    expect(calls[1]?.key).not.toBe(calls[0]?.key)
  })

  it('does not restore an intent discarded while its request was in flight', async () => {
    let failReply: (error: Error) => void = () => undefined
    const pending = new Promise<Response>((_resolve, reject) => {
      failReply = reject
    })
    stubFetch(pending)
    const refreshData = vi.fn()
    const { result } = await renderActionHook({ order: pickingOrder, refreshData })

    let attempt: Promise<void> = Promise.resolve()
    act(() => {
      attempt = result.current.runAction(pickHeadphones)
    })
    act(() => result.current.discardAwaiting())
    await act(async () => {
      failReply(new TypeError('Failed to fetch'))
      await attempt
    })

    expect(result.current.awaiting).toBeNull()
  })

  it('discards an awaiting intent on request and uses a new key next time', async () => {
    const fetchMock = stubFetch(new TypeError('Failed to fetch'), workflowResult())
    const refreshData = vi.fn()
    const { result } = await renderActionHook({ order: pickingOrder, refreshData })

    await act(async () => result.current.runAction(pickHeadphones))
    act(() => result.current.discardAwaiting())
    expect(result.current.awaiting).toBeNull()
    await act(async () => result.current.runAction(pickHeadphones))

    const [first, second] = actionCalls(fetchMock)
    expect(second?.key).not.toBe(first?.key)
  })

  it('does not keep a definitive rejection awaiting', async () => {
    const fetchMock = stubFetch(errorResponse('STALE_ORDER', 409), workflowResult())
    const refreshData = vi.fn()
    const { result } = await renderActionHook({ order: pickingOrder, refreshData })

    await act(async () => result.current.runAction(pickHeadphones))
    expect(result.current.awaiting).toBeNull()
    expect(result.current.notice).toEqual({
      tone: 'error',
      message: 'This order changed. Refresh it before trying again.',
    })
    await act(async () => result.current.runAction(pickHeadphones))

    const [first, second] = actionCalls(fetchMock)
    expect(second?.key).not.toBe(first?.key)
  })

  it('sends one request when the same action is triggered twice before the reply', async () => {
    let deliver: (reply: Response) => void = () => undefined
    const pending = new Promise<Response>((resolve) => {
      deliver = resolve
    })
    const fetchMock = stubFetch(pending)
    const refreshData = vi.fn()
    const { result } = await renderActionHook({ order: pickingOrder, refreshData })

    let first: Promise<void> = Promise.resolve()
    let second: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.runAction(pickHeadphones)
      second = result.current.runAction(pickHeadphones)
    })
    await act(async () => {
      deliver(workflowResult())
      await Promise.all([first, second])
    })

    expect(actionCalls(fetchMock)).toHaveLength(1)
  })

  it('keeps an unknown 500 outcome awaiting and retries against its own order after the selection changes', async () => {
    const fetchMock = stubFetch(errorResponse('INTERNAL_ERROR', 500), workflowResult(true))
    const refreshData = vi.fn()
    const { result, rerender } = await renderActionHook({ order: pickingOrder, refreshData })

    await act(async () => result.current.runAction(pickHeadphones))
    expect(result.current.awaiting).toEqual({ orderId: 'FO-1', action: 'pick', sku: 'AUR-220' })
    expect(result.current.notice).toEqual({ tone: 'error', message: 'The request could not be completed.' })
    rerender({ order: { ...pickingOrder, id: 'FO-2', orderNumber: 'FO-2' }, refreshData })
    await act(async () => result.current.retryAwaiting())

    const [first, second] = actionCalls(fetchMock)
    expect(second?.url).toContain('/orders/FO-1/actions')
    expect(second?.key).toBe(first?.key)
  })

  it('announces the remaining quantity after a confirmed pick', async () => {
    const pickedOrder: FulfillmentOrder = {
      ...pickingOrder,
      status: 'picking',
      version: 2,
      items: [
        { sku: 'AUR-220', name: 'Studio headphones', location: 'A-03-14', orderedQuantity: 2, pickedQuantity: 1 },
      ],
    }
    stubFetch(response({ order: pickedOrder, message: 'Picked 1 unit', replayed: false }, 201))
    const refreshData = vi.fn()
    const { result } = await renderActionHook({ order: pickingOrder, refreshData })

    await act(async () => result.current.runAction(pickHeadphones))

    expect(result.current.notice).toEqual({
      tone: 'success',
      message: 'Studio headphones: 1 of 2 picked, 1 remaining.',
    })
  })
})
