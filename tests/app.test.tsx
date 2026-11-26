import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  getDemoProfiles: vi.fn(),
  createDemoSession: vi.fn(),
  getOrders: vi.fn(),
  getReturns: vi.fn(),
  getSummary: vi.fn(),
  performOrderAction: vi.fn(),
}))

vi.mock('../src/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/api')>()),
  ...apiMocks,
}))

import App from '../src/App'
import type { DemoProfile, FulfillmentOrder } from '../src/types'
import { renderWithContent } from './test-utils'

const profiles: DemoProfile[] = [
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
  items: [{ sku: 'AUR-220', name: 'Studio headphones', location: 'A-03-14', orderedQuantity: 2, pickedQuantity: 0 }],
  allocation: null,
  package: null,
  shipment: null,
  returnInfo: null,
  events: [],
  version: 1,
}

function setupApi() {
  apiMocks.getDemoProfiles.mockResolvedValue(profiles)
  apiMocks.createDemoSession.mockImplementation(async (profileId: string) => {
    const profile = profiles.find((entry) => entry.id === profileId)
    if (!profile) throw new Error('Unknown test profile')
    return { profile }
  })
  apiMocks.getOrders.mockResolvedValue([order])
  apiMocks.getReturns.mockResolvedValue([])
  apiMocks.getSummary.mockResolvedValue({
    openOrders: 1,
    readyToPick: 0,
    packedToday: 0,
    slaAtRisk: 0,
  })
  apiMocks.performOrderAction.mockResolvedValue({
    order: { ...order, status: 'allocated', version: 2 },
    message: 'Inventory allocated.',
    replayed: false,
  })
}

describe('FulfillOps workspace', () => {
  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('loads API profiles and requires a server session before an action', async () => {
    setupApi()
    const user = userEvent.setup()
    renderWithContent(<App initialNow={Date.parse('2026-11-01T13:00:00.000Z')} />)

    await screen.findByRole('heading', { name: 'Fulfillment floor' })
    await screen.findByRole('button', { name: /FO-48291/ })
    expect(apiMocks.getDemoProfiles).toHaveBeenCalledOnce()
    await waitFor(() => expect(apiMocks.createDemoSession).toHaveBeenCalledWith('picker', expect.any(AbortSignal)))

    const profileSelect = screen.getByLabelText('Warehouse profile')
    const allocate = screen.getByRole('button', { name: 'Allocate order' })
    expect(allocate).toBeDisabled()
    await user.selectOptions(profileSelect, 'warehouse_manager')
    await waitFor(() => expect(profileSelect).toHaveValue('warehouse_manager'))
    expect(apiMocks.createDemoSession).toHaveBeenLastCalledWith('warehouse_manager')
    expect(allocate).toBeEnabled()

    await user.click(allocate)
    await waitFor(() => {
      expect(apiMocks.performOrderAction).toHaveBeenCalledWith(
        'FO-48291',
        { action: 'allocate', version: 1 },
        expect.any(String),
      )
    })
  })

  it('reuses the intent key on retry and discards it when the warehouse profile changes', async () => {
    setupApi()
    apiMocks.performOrderAction.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = userEvent.setup()
    renderWithContent(<App initialNow={Date.parse('2026-11-01T13:00:00.000Z')} />)

    const profileSelect = await screen.findByLabelText('Warehouse profile')
    await screen.findByRole('button', { name: /FO-48291/ })
    await user.selectOptions(profileSelect, 'warehouse_manager')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Allocate order' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Allocate order' }))
    await waitFor(() => expect(apiMocks.performOrderAction).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Allocate order' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Allocate order' }))
    await waitFor(() => expect(apiMocks.performOrderAction).toHaveBeenCalledTimes(2))

    await user.selectOptions(profileSelect, 'packer')
    await user.selectOptions(profileSelect, 'warehouse_manager')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Allocate order' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Allocate order' }))
    await waitFor(() => expect(apiMocks.performOrderAction).toHaveBeenCalledTimes(3))

    const keys = apiMocks.performOrderAction.mock.calls.map((call: unknown[]) => call[2])
    expect(keys[1]).toBe(keys[0])
    expect(keys[2]).not.toBe(keys[0])
  })

  it('shows the awaiting-confirmation banner after a lost reply and clears it after a safe retry', async () => {
    setupApi()
    apiMocks.performOrderAction.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({
      order: { ...order, status: 'allocated', version: 2 },
      message: 'Inventory allocated.',
      replayed: true,
    })
    const user = userEvent.setup()
    renderWithContent(<App initialNow={Date.parse('2026-11-01T13:00:00.000Z')} />)

    const profileSelect = await screen.findByLabelText('Warehouse profile')
    await screen.findByRole('button', { name: /FO-48291/ })
    await user.selectOptions(profileSelect, 'warehouse_manager')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Allocate order' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Allocate order' }))

    expect(await screen.findByText('Waiting for confirmation')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Retry safely' }))
    expect(await screen.findByText('Confirmed. This was already recorded and was not repeated.')).toBeVisible()
    expect(screen.queryByText('Waiting for confirmation')).toBeNull()
    const keys = apiMocks.performOrderAction.mock.calls.map((call: unknown[]) => call[2])
    expect(keys[1]).toBe(keys[0])
  })

  it('shows safe API failure and retry behavior', async () => {
    setupApi()
    apiMocks.getOrders.mockRejectedValue(new TypeError('database secret'))
    const user = userEvent.setup()
    renderWithContent(<App initialNow={Date.parse('2026-11-01T13:00:00.000Z')} />)

    expect(await screen.findByText('The API could not be reached. Check the local services and retry.')).toBeVisible()
    expect(screen.queryByText('database secret')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(apiMocks.getOrders).toHaveBeenCalledTimes(2))
  })

  it('fails visibly when the selected API supplies no role profiles', async () => {
    setupApi()
    apiMocks.getDemoProfiles.mockResolvedValue([])
    renderWithContent(<App initialNow={Date.parse('2026-11-01T13:00:00.000Z')} />)

    expect(await screen.findByText('Warehouse profiles are unavailable. Retry the API connection.')).toBeVisible()
    expect(screen.getByLabelText('Warehouse profile')).toBeDisabled()
    expect(apiMocks.createDemoSession).not.toHaveBeenCalled()
  })

  it('shows an empty detail state when the API returns no orders', async () => {
    setupApi()
    apiMocks.getOrders.mockResolvedValue([])
    renderWithContent(<App initialNow={Date.parse('2026-11-01T13:00:00.000Z')} />)

    expect(await screen.findByRole('heading', { name: 'Select an order' })).toBeVisible()
    expect(await screen.findByText('Try a different search or queue filter.')).toBeVisible()
  })
})
