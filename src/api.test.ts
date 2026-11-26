import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACTION_TIMEOUT_MS,
  ApiRequestError,
  createDemoSession,
  endDemoSession,
  getDemoProfiles,
  getOrders,
  getReturns,
  getSummary,
  performOrderAction,
} from './api'
import type { FulfillmentOrder } from './types'

const profiles = [
  { id: 'picker', role: 'picker' },
  { id: 'packer', role: 'packer' },
  { id: 'warehouse_manager', role: 'warehouse_manager' },
]

const order: FulfillmentOrder = {
  id: 'FO-48291',
  orderNumber: 'FO-48291',
  status: 'accepted',
  priority: 'expedite',
  channel: 'direct',
  zone: 'A-03',
  promisedAt: '2026-11-01T14:00:00.000Z',
  createdAt: '2026-11-01T12:00:00.000Z',
  items: [
    {
      sku: 'AUR-220',
      name: 'Studio headphones',
      location: 'A-03-14',
      orderedQuantity: 2,
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

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('FulfillOps API client', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads API-backed profiles and creates a cookie session', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: profiles, requestId: 'request-profiles-01' }))
      .mockResolvedValueOnce(jsonResponse({ data: { profile: profiles[2] }, requestId: 'request-session-01' }, 201))

    await expect(getDemoProfiles()).resolves.toEqual(profiles)
    await expect(createDemoSession('warehouse_manager')).resolves.toEqual({
      profile: profiles[2],
    })

    const [profilesUrl, profilesInit] = fetchMock.mock.calls[0] ?? []
    expect(profilesUrl).toContain('/api/v1/auth/profiles')
    expect(profilesInit).toMatchObject({ credentials: 'include' })
    const [sessionUrl, sessionInit] = fetchMock.mock.calls[1] ?? []
    expect(sessionUrl).toContain('/api/v1/auth/session')
    expect(sessionInit).toMatchObject({
      credentials: 'include',
      method: 'POST',
      body: JSON.stringify({ profileId: 'warehouse_manager' }),
    })
  })

  it('keeps state-changing actions cookie-authenticated and idempotent', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { loggedOut: true }, requestId: 'request-logout-01' }, 201))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: { order, message: 'Inventory allocated.', replayed: false },
            requestId: 'request-action-01',
          },
          201,
        ),
      )
    await expect(endDemoSession()).resolves.toEqual({ loggedOut: true })
    await expect(
      performOrderAction('FO-48291', { action: 'allocate', version: 1 }, 'intent-key-0001'),
    ).resolves.toMatchObject({
      order,
      replayed: false,
    })

    const [, actionInit] = fetchMock.mock.calls[1] ?? []
    const headers = new Headers(actionInit?.headers)
    expect(headers.get('Idempotency-Key')).toBe('intent-key-0001')
    expect(headers.has('X-Demo-Role')).toBe(false)
    expect(actionInit).toMatchObject({ credentials: 'include', method: 'POST' })
  })

  it('validates read API responses and supports bounded search', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [order], requestId: 'request-orders-01' }))
      .mockResolvedValueOnce(jsonResponse({ data: [order], requestId: 'request-returns-01' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: { openOrders: 1, readyToPick: 0, packedToday: 0, slaAtRisk: 1 },
          requestId: 'request-summary-01',
        }),
      )

    await expect(getOrders(' headphones ', new AbortController().signal)).resolves.toEqual([order])
    await expect(getReturns(new AbortController().signal)).resolves.toEqual([order])
    await expect(getSummary(new AbortController().signal)).resolves.toMatchObject({ openOrders: 1 })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('q=headphones')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('limit=50')
  })

  it('maps API error codes and malformed response envelopes to safe errors', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: 'ROLE_NOT_ALLOWED', message: 'private server detail' }, 403))
      .mockResolvedValueOnce(jsonResponse({ data: { profile: { role: 'owner' } }, requestId: 'bad' }))

    await expect(
      performOrderAction('FO-48291', { action: 'allocate', version: 1 }, 'intent-key-0002'),
    ).rejects.toMatchObject({
      code: 'ROLE_NOT_ALLOWED',
      message: 'ROLE_NOT_ALLOWED',
    })
    await expect(createDemoSession('owner')).rejects.toBeInstanceOf(ApiRequestError)
  })

  it('rejects invalid HTTP and JSON responses without leaking the response body', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'raw database detail' }, 502))
      .mockResolvedValueOnce(new Response('not-json', { status: 503, headers: { 'Content-Type': 'text/plain' } }))

    await expect(getSummary(new AbortController().signal)).rejects.toMatchObject({
      code: 'REQUEST_FAILED',
    })
    await expect(getSummary(new AbortController().signal)).rejects.toMatchObject({
      code: 'REQUEST_FAILED',
    })
  })

  it('sends the caller key unchanged and a fresh X-Request-Id for each attempt', async () => {
    const result = { order, message: 'Inventory allocated.', replayed: false }
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: result, requestId: 'request-attempt-01' }, 201))
      .mockResolvedValueOnce(
        jsonResponse({ data: { ...result, replayed: true }, requestId: 'request-attempt-02' }, 201),
      )
    const input = { action: 'allocate', version: 1 } as const

    await performOrderAction('FO-48291', input, 'intent-key-0003')
    await performOrderAction('FO-48291', input, 'intent-key-0003')

    const [first, second] = fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers))
    expect(first?.get('Idempotency-Key')).toBe('intent-key-0003')
    expect(second?.get('Idempotency-Key')).toBe('intent-key-0003')
    expect(first?.get('X-Request-Id')).toBeTruthy()
    expect(second?.get('X-Request-Id')).not.toBe(first?.get('X-Request-Id'))
  })

  it('reports the HTTP status on request errors', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'raw detail' }, 502))
      .mockResolvedValueOnce(jsonResponse({ code: 'INTERNAL_ERROR', message: 'detail', requestId: 'r-500' }, 500))
      .mockResolvedValueOnce(jsonResponse({ data: 'not a workflow result', requestId: 'r-201' }, 201))
    const input = { action: 'allocate', version: 1 } as const

    await expect(performOrderAction('FO-48291', input, 'intent-key-0004')).rejects.toMatchObject({
      code: 'REQUEST_FAILED',
      status: 502,
    })
    await expect(performOrderAction('FO-48291', input, 'intent-key-0004')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
    })
    await expect(performOrderAction('FO-48291', input, 'intent-key-0004')).rejects.toMatchObject({
      code: 'INVALID_CONTENT',
      status: 201,
    })
  })

  it('turns a reply that never arrives into a timeout error', async () => {
    vi.useFakeTimers()
    try {
      fetchMock.mockImplementation(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      )
      const request = performOrderAction('FO-48291', { action: 'allocate', version: 1 }, 'intent-key-0005')
      const assertion = expect(request).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' })

      await vi.advanceTimersByTimeAsync(ACTION_TIMEOUT_MS)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})
