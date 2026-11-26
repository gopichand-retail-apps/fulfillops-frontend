import { Clock3 } from 'lucide-react'
import { useContent } from '../content-model'
import type { AwaitingIntent } from '../hooks/use-fulfillment-action'

type AwaitingConfirmationProps = {
  awaiting: AwaitingIntent
  busy: boolean
  onRetry: () => void
  onDiscard: () => void
}

/** Shown while a write's outcome is unknown. Retrying resends the same intent, so it cannot apply twice. */
export default function AwaitingConfirmation({ awaiting, busy, onRetry, onDiscard }: AwaitingConfirmationProps) {
  const { t } = useContent()
  const body = t('awaiting.body', {
    action: t(`awaiting.action.${awaiting.action}`),
    orderNumber: awaiting.orderId,
  })

  return (
    <section className="awaiting-banner" role="alert" aria-labelledby="awaiting-title">
      <Clock3 size={17} aria-hidden="true" />
      <div className="awaiting-copy">
        <strong id="awaiting-title">{t('awaiting.title')}</strong>
        <p>{body}</p>
      </div>
      <div className="awaiting-actions">
        <button
          type="button"
          className="button-primary"
          aria-disabled={busy}
          onClick={() => {
            if (!busy) onRetry()
          }}
        >
          {busy ? t('awaiting.working') : t('awaiting.retry')}
        </button>
        <button type="button" className="button-secondary" onClick={onDiscard}>
          {t('awaiting.discard')}
        </button>
      </div>
    </section>
  )
}
