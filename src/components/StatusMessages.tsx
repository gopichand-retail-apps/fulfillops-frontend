import { Activity, AlertTriangle, X } from 'lucide-react'
import { useContent } from '../content-model'
import type { WorkflowNotice } from '../hooks/use-fulfillment-action'

type StatusMessagesProps = {
  loadError: string | null
  authError: string | null
  notice: WorkflowNotice | null
  onRetryData: () => void
  onRetrySession: () => void
  onDismissNotice: () => void
}

export default function StatusMessages({
  loadError,
  authError,
  notice,
  onRetryData,
  onRetrySession,
  onDismissNotice,
}: StatusMessagesProps) {
  const { t } = useContent()

  return (
    <>
      {loadError && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{loadError}</span>
          <button type="button" onClick={onRetryData}>
            {t('action.retry')}
          </button>
        </div>
      )}
      {authError && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{authError}</span>
          <button type="button" onClick={onRetrySession}>
            {t('action.retry')}
          </button>
        </div>
      )}
      {notice && (
        <div className={`notice ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          <span>{notice.tone === 'success' ? <Activity size={16} /> : <AlertTriangle size={16} />}</span>
          <p>{notice.message}</p>
          <button type="button" onClick={onDismissNotice} aria-label={t('action.dismiss')}>
            <X size={16} />
          </button>
        </div>
      )}
    </>
  )
}
