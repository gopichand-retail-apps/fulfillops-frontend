import { useCallback, useEffect, useState } from 'react'
import { performOrderAction } from '../api'
import type { OrderActionInput } from '../api'
import { displayApiError } from '../api-errors'
import { useContent } from '../content-model'
import type { FulfillmentOrder } from '../types'

export type WorkflowNotice = { tone: 'success' | 'error'; message: string }

type UseFulfillmentActionOptions = {
  order: FulfillmentOrder | null
  refreshData: () => void
}

export function useFulfillmentAction({ order, refreshData }: UseFulfillmentActionOptions) {
  const { model, t } = useContent()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [notice, setNotice] = useState<WorkflowNotice | null>(null)

  const runAction = useCallback(
    async (action: OrderActionInput): Promise<void> => {
      if (!order) return
      setPendingAction(action.action)
      setNotice(null)

      try {
        await performOrderAction(order.id, {
          ...action,
          version: order.version,
        })
        setNotice({ tone: 'success', message: t(`notice.${action.action}`) })
        refreshData()
      } catch (error) {
        setNotice({ tone: 'error', message: displayApiError(error, t, model.messages) })
        refreshData()
      } finally {
        setPendingAction(null)
      }
    },
    [model.messages, order, refreshData, t],
  )

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 5200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  return { pendingAction, notice, setNotice, runAction }
}
