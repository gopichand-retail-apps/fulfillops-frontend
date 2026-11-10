import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
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
    await expect(performOrderAction('FO-48291', { action: 'allocate', version: 1 })).resolves.toMatchObject({
      order,
      replayed: false,
    })

    const [, actionInit] = fetchMock.mock.calls[1] ?? []
    const headers = new Headers(actionInit?.headers)
    expect(headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i)
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

    await expect(performOrderAction('FO-48291', { action: 'allocate', version: 1 })).rejects.toMatchObject({
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
})
