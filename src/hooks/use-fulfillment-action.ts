import { useCallback, useEffect, useRef, useState } from 'react'
import { performOrderAction } from '../api'
import type { OrderActionInput } from '../api'
import { displayApiError } from '../api-errors'
import { dataStringMap, useContent } from '../content-model'
import { createActionIntent, isOutcomeUnknown, isSamePayload } from '../domain/action-intent'
import type { ActionIntent } from '../domain/action-intent'
import type { FulfillmentAction, FulfillmentOrder, WorkflowResult } from '../types'

export type WorkflowNotice = { tone: 'success' | 'error'; message: string }

/** Display-safe view of an unresolved intent. The key itself never leaves the hook. */
export type AwaitingIntent = { orderId: string; action: FulfillmentAction; sku?: string }

type UseFulfillmentActionOptions = {
  order: FulfillmentOrder | null
  refreshData: () => void
}

function toAwaiting({ orderId, input }: ActionIntent): AwaitingIntent {
  return { orderId, action: input.action, ...(input.sku ? { sku: input.sku } : {}) }
}

/**
 * Runs warehouse writes with the stable intent key pattern. Callers discard the intent when the warehouse
 * profile changes (sign-out of the previous session) by calling `discardAwaiting` from that event.
 */
export function useFulfillmentAction({ order, refreshData }: UseFulfillmentActionOptions) {
  const { model, t } = useContent()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [awaiting, setAwaiting] = useState<AwaitingIntent | null>(null)
  const [notice, setNotice] = useState<WorkflowNotice | null>(null)
  const intentRef = useRef<ActionIntent | null>(null)
  const inFlightRef = useRef(false)

  const discardAwaiting = useCallback(() => {
    intentRef.current = null
    setAwaiting(null)
  }, [])

  const settleFailure = useCallback(
    (intent: ActionIntent, error: unknown) => {
      if (intentRef.current === intent) {
        if (isOutcomeUnknown(error)) setAwaiting(toAwaiting(intent))
        else discardAwaiting()
      }
      setNotice({ tone: 'error', message: displayApiError(error, t, model.messages) })
    },
    [discardAwaiting, model.messages, t],
  )

  const describeSuccess = useCallback(
    (intent: ActionIntent, result: WorkflowResult): string => {
      if (result.replayed) return t('notice.recovered')
      const { action, sku } = intent.input
      const item = action === 'pick' ? result.order.items.find((candidate) => candidate.sku === sku) : undefined
      if (!item) return t(`notice.${action}`)
      return t('notice.pickProgress', {
        item: dataStringMap(model, 'itemNames')[item.sku] ?? t('page.orderDetails.unknownItem'),
        picked: item.pickedQuantity,
        ordered: item.orderedQuantity,
        remaining: item.orderedQuantity - item.pickedQuantity,
      })
    },
    [model, t],
  )

  const send = useCallback(
    async (intent: ActionIntent): Promise<void> => {
      inFlightRef.current = true
      setPendingAction(intent.input.action)
      setNotice(null)
      try {
        const result = await performOrderAction(
          intent.orderId,
          { ...intent.input, version: intent.version },
          intent.key,
        )
        if (intentRef.current === intent) discardAwaiting()
        setNotice({ tone: 'success', message: describeSuccess(intent, result) })
      } catch (error) {
        settleFailure(intent, error)
      } finally {
        inFlightRef.current = false
        setPendingAction(null)
        refreshData()
      }
    },
    [describeSuccess, discardAwaiting, refreshData, settleFailure],
  )

  const runAction = useCallback(
    async (input: OrderActionInput): Promise<void> => {
      if (!order || inFlightRef.current) return
      const kept = intentRef.current
      const reuse = kept !== null && isSamePayload(kept, order.id, input)
      const intent = reuse ? kept : createActionIntent(order.id, input, order.version)
      if (!reuse) {
        intentRef.current = intent
        setAwaiting(null)
      }
      await send(intent)
    },
    [order, send],
  )

  const retryAwaiting = useCallback(async (): Promise<void> => {
    const intent = intentRef.current
    if (!intent || inFlightRef.current) return
    await send(intent)
  }, [send])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 5200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  return { pendingAction, awaiting, notice, setNotice, runAction, retryAwaiting, discardAwaiting }
}
