import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StatusMessages from '../src/components/StatusMessages'
import { renderWithContent } from './test-utils'

describe('StatusMessages', () => {
  it('renders data, authentication, and workflow errors with retry actions', async () => {
    const onRetryData = vi.fn()
    const onRetrySession = vi.fn()
    const onDismissNotice = vi.fn()
    renderWithContent(
      <StatusMessages
        loadError="The queue failed."
        authError="Profile session expired."
        notice={{ tone: 'error', message: 'The update was rejected.' }}
        onRetryData={onRetryData}
        onRetrySession={onRetrySession}
        onDismissNotice={onDismissNotice}
      />,
    )

    await screen.findByText('The queue failed.')
    expect(screen.getAllByRole('alert')).toHaveLength(3)
    const retryButtons = screen.getAllByRole('button', { name: 'Retry' })
    const retryDataButton = retryButtons.at(0)
    const retrySessionButton = retryButtons.at(1)
    if (!retryDataButton || !retrySessionButton) {
      throw new Error('Expected both retry controls.')
    }
    fireEvent.click(retryDataButton)
    fireEvent.click(retrySessionButton)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(onRetryData).toHaveBeenCalledOnce()
    expect(onRetrySession).toHaveBeenCalledOnce()
    expect(onDismissNotice).toHaveBeenCalledOnce()
  })

  it('renders no banners when clear', async () => {
    renderWithContent(
      <StatusMessages
        loadError={null}
        authError={null}
        notice={null}
        onRetryData={vi.fn()}
        onRetrySession={vi.fn()}
        onDismissNotice={vi.fn()}
      />,
    )
    await waitFor(() => expect(document.title).toBe('FulfillOps | Warehouse operations'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('uses status role for successful workflow messages', async () => {
    renderWithContent(
      <StatusMessages
        loadError={null}
        authError={null}
        notice={{ tone: 'success', message: 'Shipment simulated.' }}
        onRetryData={vi.fn()}
        onRetrySession={vi.fn()}
        onDismissNotice={vi.fn()}
      />,
    )
    await screen.findByText('Shipment simulated.')
    expect(screen.getByRole('status')).toHaveTextContent('Shipment simulated.')
  })
})
