import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceHeader, WorkspaceSidebar } from '../src/components/WorkspaceChrome'
import type { DemoProfile } from '../src/types'
import { renderWithContent } from './test-utils'

describe('FulfillOps workspace navigation', () => {
  it('switches views and selects only API-provided profiles', async () => {
    const profiles: DemoProfile[] = [
      { id: 'picker', role: 'picker' },
      { id: 'warehouse_manager', role: 'warehouse_manager' },
    ]
    const onViewChange = vi.fn()
    const onProfileChange = vi.fn()
    renderWithContent(
      <>
        <WorkspaceSidebar
          view="queue"
          queueCount={4}
          returnCount={1}
          warehouseName="North DC"
          warehouseCode="WH-04"
          onChange={onViewChange}
        />
        <WorkspaceHeader
          warehouseName="North DC"
          view="queue"
          isOnline
          role="picker"
          profiles={profiles}
          rolesLoading={false}
          onProfileChange={onProfileChange}
          onViewChange={onViewChange}
        />
      </>,
    )

    await screen.findByLabelText('Warehouse profile')
    const returnsButtons = screen.getAllByRole('button', { name: /Returns/ })
    const firstReturnsButton = returnsButtons[0]
    if (!firstReturnsButton) throw new Error('Expected a returns navigation button.')
    fireEvent.click(firstReturnsButton)
    expect(onViewChange).toHaveBeenCalledWith('returns')
    fireEvent.change(screen.getByLabelText('Warehouse profile'), {
      target: { value: 'warehouse_manager' },
    })
    expect(onProfileChange).toHaveBeenCalledWith('warehouse_manager')
    expect(screen.getByText('North DC')).toBeVisible()
    expect(screen.getByText('API connected')).toBeVisible()
  })

  it('marks the active returns view in desktop and mobile navigation', async () => {
    const onSidebarChange = vi.fn()
    const onHeaderChange = vi.fn()
    renderWithContent(
      <>
        <WorkspaceSidebar
          view="returns"
          queueCount={4}
          returnCount={1}
          warehouseName="North DC"
          warehouseCode="WH-04"
          onChange={onSidebarChange}
        />
        <WorkspaceHeader
          warehouseName="North DC"
          view="returns"
          isOnline
          role="picker"
          profiles={[{ id: 'picker', role: 'picker' }]}
          rolesLoading={false}
          onProfileChange={vi.fn()}
          onViewChange={onHeaderChange}
        />
      </>,
    )

    await screen.findByLabelText('Warehouse profile')
    const activeButtons = screen.getAllByRole('button', { name: /Returns/ })
    expect(activeButtons).toHaveLength(2)
    expect(activeButtons.every((button) => button.classList.contains('active'))).toBe(true)
    const queueButtons = screen.getAllByRole('button', { name: /Work queue/ })
    const sidebarQueueButton = queueButtons[0]
    const mobileReturnsButton = activeButtons[1]
    if (!sidebarQueueButton || !mobileReturnsButton) {
      throw new Error('Expected desktop and mobile navigation buttons.')
    }
    fireEvent.click(sidebarQueueButton)
    fireEvent.click(mobileReturnsButton)
    expect(onSidebarChange).toHaveBeenCalledWith('queue')
    expect(onHeaderChange).toHaveBeenCalledWith('returns')
  })

  it('disables profile selection while roles are loading or unavailable', async () => {
    renderWithContent(
      <WorkspaceHeader
        warehouseName="North DC"
        view="queue"
        isOnline={false}
        role="picker"
        profiles={[]}
        rolesLoading
        onProfileChange={vi.fn()}
        onViewChange={vi.fn()}
      />,
    )

    expect(await screen.findByLabelText('Warehouse profile')).toBeDisabled()
    expect(screen.getByText('API offline')).toBeVisible()
  })
})
