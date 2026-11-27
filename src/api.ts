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

/** An action whose reply has not arrived by then is treated as an unknown outcome, not a failure. */
export const ACTION_TIMEOUT_MS = 10_000

export class ApiRequestError extends Error {
  readonly code: string
  readonly status: number | undefined

  constructor(code: string, status?: number) {
    super(code)
    this.code = code
    this.status = status
    this.name = 'ApiRequestError'
  }
}

type RawResponse = { response: Response; payload: unknown }

async function fetchJson(path: string, options: RequestInit, timeoutMs?: number): Promise<RawResponse> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Request-Id', crypto.randomUUID())
  if (options.body) headers.set('Content-Type', 'application/json')

  const timeout = timeoutMs === undefined ? null : new AbortController()
  let timedOut = false
  const timer = timeout
    ? globalThis.setTimeout(() => {
        timedOut = true
        timeout.abort()
      }, timeoutMs)
    : undefined

  try {
    const response = await fetch(`${apiRoot}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      ...(timeout ? { signal: timeout.signal } : {}),
    })
    const payload: unknown = await response.json().catch(() => null)
    if (timedOut) throw new ApiRequestError('REQUEST_TIMEOUT')
    return { response, payload }
  } catch (error) {
    throw timedOut ? new ApiRequestError('REQUEST_TIMEOUT') : error
  } finally {
    globalThis.clearTimeout(timer)
  }
}

async function requestData<TSchema extends z.ZodType>(
  path: string,
  dataSchema: TSchema,
  options: RequestInit = {},
  timeoutMs?: number,
): Promise<z.infer<TSchema>> {
  const { response, payload } = await fetchJson(path, options, timeoutMs)

  if (!response.ok) {
    const error = apiErrorSchema.safeParse(payload)
    throw new ApiRequestError(error.success ? error.data.code : 'REQUEST_FAILED', response.status)
  }

  const envelope = successEnvelopeSchema.safeParse(payload)
  if (!envelope.success) throw new ApiRequestError('INVALID_RESPONSE', response.status)
  const data = dataSchema.safeParse(envelope.data.data)
  if (!data.success) throw new ApiRequestError('INVALID_CONTENT', response.status)
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

/** The caller owns the key: one key per confirmed intent, reused for every retry of it. */
export function performOrderAction(
  orderId: string,
  action: OrderActionInput & { version: number },
  idempotencyKey: string,
) {
  return requestData(
    `/orders/${encodeURIComponent(orderId)}/actions`,
    workflowResultSchema,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(action),
    },
    ACTION_TIMEOUT_MS,
  )
}
