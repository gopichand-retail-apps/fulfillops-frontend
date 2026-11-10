import { afterEach, describe, expect, it, vi } from 'vitest'

describe('FulfillOps API mode configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to mock mode and the local loopback API in development', async () => {
    vi.resetModules()
    const config = await import('../src/config')

    expect(config.isMock).toBe(true)
    expect(config.resolveApiBaseUrl('http://127.0.0.1:5202/api/v1')).toBe('http://127.0.0.1:5202/api/v1')
  })

  it('selects and normalizes the configured mock endpoint', async () => {
    vi.stubEnv('VITE_IS_MOCK', 'true')
    vi.stubEnv('VITE_MOCK_API_BASE_URL', 'http://127.0.0.1:5212/api/v1///')
    vi.resetModules()
    const config = await import('../src/config')

    expect(config.isMock).toBe(true)
    expect(config.resolveApiBaseUrl('http://127.0.0.1:5202/api/v1')).toBe('http://127.0.0.1:5212/api/v1')
  })

  it('uses the development-only legacy mock endpoint alias', async () => {
    vi.stubEnv('VITE_IS_MOCK', 'true')
    vi.resetModules()
    const config = await import('../src/config')

    expect(config.resolveApiBaseUrl('http://127.0.0.1:5202/api/v1', 'http://127.0.0.1:5222/api/v1/')).toBe(
      'http://127.0.0.1:5222/api/v1',
    )
  })

  it('selects the real endpoint without falling back to the mock endpoint', async () => {
    vi.stubEnv('VITE_IS_MOCK', 'false')
    vi.stubEnv('VITE_MOCK_API_BASE_URL', 'http://127.0.0.1:5212/api/v1')
    vi.stubEnv('VITE_REAL_API_BASE_URL', 'https://fulfillment.example.invalid/api/v1')
    vi.resetModules()
    const config = await import('../src/config')

    expect(config.isMock).toBe(false)
    expect(config.resolveApiBaseUrl('http://127.0.0.1:5202/api/v1')).toBe('https://fulfillment.example.invalid/api/v1')
  })

  it('fails clearly when the mode or selected endpoint is invalid', async () => {
    vi.stubEnv('VITE_IS_MOCK', 'sometimes')
    vi.resetModules()
    await expect(import('../src/config')).rejects.toThrow('VITE_IS_MOCK must be "true" or "false".')

    vi.stubEnv('VITE_IS_MOCK', 'false')
    vi.stubEnv('VITE_REAL_API_BASE_URL', '')
    vi.resetModules()
    const missingEndpoint = await import('../src/config')
    expect(() => missingEndpoint.resolveApiBaseUrl('http://127.0.0.1:5202/api/v1')).toThrow(
      'VITE_REAL_API_BASE_URL is required when VITE_IS_MOCK=false.',
    )

    vi.stubEnv('VITE_IS_MOCK', 'true')
    vi.stubEnv('VITE_MOCK_API_BASE_URL', 'javascript:alert(1)')
    vi.resetModules()
    const invalidUrl = await import('../src/config')
    expect(() => invalidUrl.resolveApiBaseUrl('http://127.0.0.1:5202/api/v1')).toThrow(
      'The selected API base URL must use HTTP or HTTPS.',
    )

    vi.stubEnv('VITE_IS_MOCK', 'false')
    vi.stubEnv('VITE_REAL_API_BASE_URL', 'not-an-absolute-url')
    vi.resetModules()
    const malformedUrl = await import('../src/config')
    expect(() => malformedUrl.resolveApiBaseUrl('http://127.0.0.1:5202/api/v1')).toThrow(
      'The selected API base URL must be an absolute HTTP(S) URL.',
    )

    vi.stubEnv('VITE_IS_MOCK', 'true')
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_MOCK_API_BASE_URL', '')
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.resetModules()
    const missingProductionMockEndpoint = await import('../src/config')
    expect(() => missingProductionMockEndpoint.resolveApiBaseUrl('http://127.0.0.1:5202/api/v1')).toThrow(
      'VITE_MOCK_API_BASE_URL is required in production when VITE_IS_MOCK=true.',
    )
  })
})
