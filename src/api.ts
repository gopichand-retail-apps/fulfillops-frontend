import { z } from 'zod'
import { resolveApiBaseUrl } from './config'
import {
  apiErrorSchema,
  demoProfileSchema,
  fulfillmentOrderSchema,
  workflowResultSchema,
  workflowSummarySchema,
} from './types'
import type { FulfillmentAction, FulfillmentOrder, ReturnReason } from './types'

const apiRoot = resolveApiBaseUrl('http://127.0.0.1:5202/api/v1', import.meta.env.VITE_API_BASE_URL)
const successEnvelopeSchema = z.object({ data: z.unknown(), requestId: z.string() })

export type OrderActionInput = {
  action: FulfillmentAction
  sku?: string
  quantity?: number
  reason?: ReturnReason
}

export class ApiRequestError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'ApiRequestError'
  }
}

async function requestData<TSchema extends z.ZodType>(
  path: string,
  dataSchema: TSchema,
  options: RequestInit = {},
): Promise<z.infer<TSchema>> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Request-Id', crypto.randomUUID())
  if (options.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = apiErrorSchema.safeParse(payload)
    throw new ApiRequestError(error.success ? error.data.code : 'REQUEST_FAILED')
  }

  const envelope = successEnvelopeSchema.safeParse(payload)
  if (!envelope.success) throw new ApiRequestError('INVALID_RESPONSE')
  const data = dataSchema.safeParse(envelope.data.data)
  if (!data.success) throw new ApiRequestError('INVALID_CONTENT')
  return data.data
}

export function getDemoProfiles(signal?: AbortSignal) {
  return requestData('/auth/profiles', z.array(demoProfileSchema).min(1), signal ? { signal } : {})
}

export function createDemoSession(profileId: string, signal?: AbortSignal) {
  const responseSchema = z.object({ profile: demoProfileSchema })
  return requestData('/auth/session', responseSchema, {
    method: 'POST',
    body: JSON.stringify({ profileId }),
    ...(signal ? { signal } : {}),
  })
}

export function endDemoSession() {
  return requestData('/auth/logout', z.object({ loggedOut: z.boolean() }), {
    method: 'POST',
  })
}

export function getOrders(query: string, signal: AbortSignal): Promise<FulfillmentOrder[]> {
  const params = new URLSearchParams({ limit: '50' })
  if (query.trim()) params.set('q', query.trim())
  return requestData(`/orders?${params.toString()}`, z.array(fulfillmentOrderSchema), { signal })
}

export function getReturns(signal: AbortSignal) {
  return requestData('/returns', z.array(fulfillmentOrderSchema), { signal })
}

export function getSummary(signal: AbortSignal) {
  return requestData('/summary', workflowSummarySchema, { signal })
}

export function performOrderAction(orderId: string, action: OrderActionInput & { version: number }) {
  return requestData(`/orders/${encodeURIComponent(orderId)}/actions`, workflowResultSchema, {
    method: 'POST',
    headers: {
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(action),
  })
}
