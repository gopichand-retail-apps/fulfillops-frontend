import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDemoSession } from '../src/hooks/use-demo-session'
import { defaultContentModel } from './test-utils'

const profiles = [
  { id: 'picker', role: 'picker' },
  { id: 'warehouse_manager', role: 'warehouse_manager' },
]

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data, requestId: 'session-test-request' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(code: string, status: number): Response {
  return new Response(JSON.stringify({ code, message: 'secret', requestId: 'session-error' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function translate(key: string): string {
  const message = defaultContentModel.messages[key]
  if (message === undefined) throw new Error(`Missing message: ${key}`)
  return message
}

describe('useDemoSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a server session for the default picker profile', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(profiles))
      .mockResolvedValueOnce(jsonResponse({ profile: profiles[0] }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDemoSession({ t: translate, messages: defaultContentModel.messages }))

    await waitFor(() => expect(result.current.rolesLoading).toBe(false))
    expect(result.current.role).toBe('picker')
    expect(result.current.profiles).toEqual(profiles)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ credentials: 'include' })
  })

  it('uses the first API profile when a picker profile is unavailable', async () => {
    const onlyPacker = [{ id: 'packer', role: 'packer' }]
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(onlyPacker))
      .mockResolvedValueOnce(jsonResponse({ profile: onlyPacker[0] }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDemoSession({ t: translate, messages: defaultContentModel.messages }))
    await waitFor(() => expect(result.current.role).toBe('packer'))
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      body: JSON.stringify({ profileId: 'packer' }),
    })
  })

  it('shows a safe error when profile discovery or session issuance fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse('PROFILE_SERVICE_DOWN', 503))
      .mockResolvedValueOnce(jsonResponse(profiles))
      .mockResolvedValueOnce(errorResponse('AUTH_REQUIRED', 401))
    vi.stubGlobal('fetch', fetchMock)

    const first = renderHook(() => useDemoSession({ t: translate, messages: defaultContentModel.messages }))
    await waitFor(() => expect(first.result.current.rolesLoading).toBe(false))
    expect(first.result.current.authError).toBe('The request could not be completed.')

    first.unmount()
    const second = renderHook(() => useDemoSession({ t: translate, messages: defaultContentModel.messages }))
    await waitFor(() => expect(second.result.current.rolesLoading).toBe(false))
    expect(second.result.current.authError).toBe('Select a warehouse profile to continue.')
  })

  it('rejects unknown UI profile IDs and preserves the active role on failed change', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(profiles))
      .mockResolvedValueOnce(jsonResponse({ profile: profiles[0] }, 201))
      .mockResolvedValueOnce(errorResponse('AUTH_REQUIRED', 401))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useDemoSession({ t: translate, messages: defaultContentModel.messages }))
    await waitFor(() => expect(result.current.rolesLoading).toBe(false))
    await result.current.changeProfile('administrator')
    await waitFor(() => expect(result.current.authError).toBe('That warehouse profile is not available.'))
    await result.current.changeProfile('warehouse_manager')
    await waitFor(() => {
      expect(result.current.role).toBe('picker')
      expect(result.current.authError).toBe('Select a warehouse profile to continue.')
    })
  })
})
