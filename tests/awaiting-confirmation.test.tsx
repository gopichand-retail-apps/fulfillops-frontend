import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AwaitingConfirmation from '../src/components/AwaitingConfirmation'
import { renderWithContent } from './test-utils'

const awaitingPick = { orderId: 'FO-48262', action: 'pick', sku: 'MUG-008' } as const

describe('AwaitingConfirmation', () => {
  it('explains the unknown outcome with model copy', async () => {
    renderWithContent(
      <AwaitingConfirmation awaiting={awaitingPick} busy={false} onRetry={vi.fn()} onDiscard={vi.fn()} />,
    )

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Waiting for confirmation')
    expect(banner).toHaveTextContent(
      'We could not confirm the pick for FO-48262. It may already be recorded. Retrying is safe and will not repeat it.',
    )
    expect(banner.textContent).not.toMatch(/awaiting\.|\{\{/)
  })

  it('offers a safe retry and a discard', async () => {
    const onRetry = vi.fn()
    const onDiscard = vi.fn()
    renderWithContent(
      <AwaitingConfirmation awaiting={awaitingPick} busy={false} onRetry={onRetry} onDiscard={onDiscard} />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Retry safely' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard attempt' }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onDiscard).toHaveBeenCalledOnce()
  })

  it('keeps the retry control focusable but inert while a retry is confirming', async () => {
    const onRetry = vi.fn()
    renderWithContent(<AwaitingConfirmation awaiting={awaitingPick} busy onRetry={onRetry} onDiscard={vi.fn()} />)

    const retry = await screen.findByRole('button', { name: 'Confirming…' })
    expect(retry).toHaveAttribute('aria-disabled', 'true')
    expect(retry).not.toBeDisabled()
    fireEvent.click(retry)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('can be operated from the keyboard', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    renderWithContent(
      <AwaitingConfirmation awaiting={awaitingPick} busy={false} onRetry={onRetry} onDiscard={vi.fn()} />,
    )

    await screen.findByRole('button', { name: 'Retry safely' })
    await user.tab()
    expect(screen.getByRole('button', { name: 'Retry safely' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
