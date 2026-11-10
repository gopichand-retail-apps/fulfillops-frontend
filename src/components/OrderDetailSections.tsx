import { useState } from 'react'
import { Box, Check, PackageCheck, RotateCcw, ShieldCheck, Truck } from 'lucide-react'
import type { OrderActionInput } from '../api'
import { dataStringMap, useContent } from '../content-model'
import { formatTime } from '../formatters'
import type { DemoRole, FulfillmentAction, FulfillmentOrder, OrderStatus, ReturnReason } from '../types'

const actionRoles: Record<FulfillmentAction, DemoRole[]> = {
  allocate: ['warehouse_manager'],
  pick: ['picker'],
  pack: ['packer'],
  ship: ['packer', 'warehouse_manager'],
  return: ['warehouse_manager'],
}

const stages: OrderStatus[] = ['accepted', 'allocated', 'picked', 'packed', 'shipped']
const returnReasons: ReturnReason[] = ['damaged', 'wrong_item', 'customer_changed_mind']

function activeStage(status: FulfillmentOrder['status']): number {
  if (status === 'accepted') return 0
  if (status === 'allocated' || status === 'picking') return 1
  if (status === 'picked') return 2
  if (status === 'packed') return 3
  return 4
}

function nextAction(status: FulfillmentOrder['status']): FulfillmentAction | null {
  const actions: Record<FulfillmentOrder['status'], FulfillmentAction | null> = {
    accepted: 'allocate',
    allocated: 'pick',
    picking: 'pick',
    picked: 'pack',
    packed: 'ship',
    shipped: 'return',
    returned: null,
  }
  return actions[status]
}

export function OrderProgress({ order }: { order: FulfillmentOrder }) {
  const { t, model } = useContent()
  const stage = activeStage(order.status)

  return (
    <section className="flow-section" aria-labelledby="flow-title">
      <div className="detail-section-heading">
        <div>
          <span className="section-index">01</span>
          <h3 id="flow-title">{t('page.orderDetails.flow')}</h3>
        </div>
        <span className="flow-date">
          {t('page.orderDetails.created', { time: formatTime(order.createdAt, model.locale) })}
        </span>
      </div>
      <ol className="flow-steps">
        {stages.map((status, index) => {
          const complete = index < stage || order.status === 'returned'
          const current = index === stage && order.status !== 'returned'
          const stepClass = complete ? 'flow-step complete' : current ? 'flow-step current' : 'flow-step'
          return (
            <li className={stepClass} key={status}>
              <span className="step-marker">{complete ? <Check size={13} /> : index + 1}</span>
              <span>{t(`flow.${status}`)}</span>
            </li>
          )
        })}
      </ol>
      {order.status === 'returned' && order.returnInfo && (
        <div className="return-summary">
          <RotateCcw size={15} />
          <span>
            {t('page.orderDetails.returnRecorded', {
              reason: t(`returnReason.${order.returnInfo.reason}`),
            })}
          </span>
        </div>
      )}
    </section>
  )
}

type OrderItemsProps = {
  order: FulfillmentOrder
  role: DemoRole
  pendingAction: string | null
  onAction: (action: OrderActionInput) => void
}

export function OrderItems({ order, role, pendingAction, onAction }: OrderItemsProps) {
  const { model, t } = useContent()
  const itemNames = dataStringMap(model, 'itemNames')
  const isPickStep = nextAction(order.status) === 'pick'

  return (
    <section className="items-section" aria-labelledby="items-title">
      <div className="detail-section-heading">
        <div>
          <span className="section-index">02</span>
          <h3 id="items-title">{t('page.orderDetails.items')}</h3>
        </div>
        <span className="item-count">{t('page.orderDetails.itemLines', { count: order.items.length })}</span>
      </div>
      <div className="item-list">
        {order.items.map((item) => {
          const complete = item.pickedQuantity >= item.orderedQuantity
          const canPick = isPickStep && role === 'picker' && !complete && !pendingAction
          const itemName = itemNames[item.sku] ?? t('page.orderDetails.unknownItem')
          return (
            <article className="item-row" key={item.sku}>
              <span className={complete ? 'item-check complete' : 'item-check'}>
                {complete ? <Check size={14} /> : <Box size={15} />}
              </span>
              <div className="item-description">
                <strong>{itemName}</strong>
                <span>
                  <code>{item.sku}</code> <span className="row-separator">·</span> <span>{item.location}</span>
                </span>
              </div>
              <span className={complete ? 'picked-quantity complete' : 'picked-quantity'}>
                {item.pickedQuantity}/{item.orderedQuantity}
              </span>
              {isPickStep && (
                <button
                  className={complete ? 'pick-unit picked' : 'pick-unit'}
                  type="button"
                  disabled={!canPick}
                  onClick={() => onAction({ action: 'pick', sku: item.sku, quantity: 1 })}
                  aria-label={t('page.orderDetails.pickOne', { item: itemName })}
                >
                  {complete ? <Check size={14} /> : <PackageCheck size={14} />}
                  <span>{complete ? t('page.orderDetails.done') : t('page.orderDetails.pickOneButton')}</span>
                </button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ReturnForm({
  pendingAction,
  actionIsAllowed,
  onAction,
  onCancel,
}: {
  pendingAction: string | null
  actionIsAllowed: boolean
  onAction: (action: OrderActionInput) => void
  onCancel: () => void
}) {
  const { t } = useContent()
  const [reason, setReason] = useState<ReturnReason>('damaged')

  function submitReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onAction({ action: 'return', reason })
  }

  return (
    <form className="return-form" onSubmit={submitReturn}>
      <label htmlFor="return-reason">{t('page.orderDetails.returnReason')}</label>
      <select
        id="return-reason"
        value={reason}
        onChange={(event) => setReason(event.currentTarget.value as ReturnReason)}
      >
        {returnReasons.map((returnReason) => (
          <option value={returnReason} key={returnReason}>
            {t(`returnReason.select.${returnReason}`)}
          </option>
        ))}
      </select>
      <div className="return-form-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>
          {t('page.orderDetails.cancel')}
        </button>
        <button type="submit" className="button-primary" disabled={!actionIsAllowed || Boolean(pendingAction)}>
          {t('page.orderDetails.recordReturn')}
        </button>
      </div>
    </form>
  )
}

function ActionIcon({ action }: { action: FulfillmentAction }) {
  if (action === 'ship') return <Truck size={16} />
  if (action === 'return') return <RotateCcw size={16} />
  return <PackageCheck size={16} />
}

function ActionControl({
  action,
  returnFormOpen,
  pendingAction,
  actionIsAllowed,
  requiredRoles,
  onAction,
  onOpenReturn,
  onCancelReturn,
}: {
  action: FulfillmentAction
  returnFormOpen: boolean
  pendingAction: string | null
  actionIsAllowed: boolean
  requiredRoles: string
  onAction: (action: OrderActionInput) => void
  onOpenReturn: () => void
  onCancelReturn: () => void
}) {
  const { t } = useContent()

  if (action === 'pick') {
    return <span className="pick-instruction">{t('page.orderDetails.pickInstruction')}</span>
  }
  if (action === 'return' && returnFormOpen) {
    return (
      <ReturnForm
        pendingAction={pendingAction}
        actionIsAllowed={actionIsAllowed}
        onAction={onAction}
        onCancel={onCancelReturn}
      />
    )
  }

  const triggerAction = action === 'return' ? onOpenReturn : () => onAction({ action })
  return (
    <button
      className="button-primary action-button"
      type="button"
      disabled={!actionIsAllowed || Boolean(pendingAction)}
      onClick={triggerAction}
      title={!actionIsAllowed ? t('page.orderDetails.roleWarning', { role: requiredRoles }) : undefined}
    >
      <ActionIcon action={action} />
      {pendingAction === action ? t('page.orderDetails.working') : t(`action.${action}.button`)}
    </button>
  )
}

export function OrderActionPanel({ order, role, pendingAction, onAction }: OrderItemsProps) {
  const { t } = useContent()
  const [returnFormOpen, setReturnFormOpen] = useState(false)
  const action = nextAction(order.status)
  const actionIsAllowed = action ? actionRoles[action].includes(role) : false
  const requiredRoles = action ? actionRoles[action].map((item) => t(`role.${item}`)).join(t('generic.or')) : ''

  return (
    <section className="action-section" aria-label={t('page.orderDetails.actionAriaLabel')}>
      <div className="detail-section-heading">
        <div>
          <span className="section-index">03</span>
          <h3>{t('page.orderDetails.action')}</h3>
        </div>
        {action && (
          <span className="role-requirement">
            <ShieldCheck size={13} /> {t('page.orderDetails.roleRequirement', { role: requiredRoles })}
          </span>
        )}
      </div>
      {action ? (
        <div className="next-action-panel">
          <div className="action-copy">
            <strong>{t(`action.${action}.title`)}</strong>
            <p>{t(`action.${action}.description`)}</p>
          </div>
          <ActionControl
            action={action}
            returnFormOpen={returnFormOpen}
            pendingAction={pendingAction}
            actionIsAllowed={actionIsAllowed}
            requiredRoles={requiredRoles}
            onAction={onAction}
            onOpenReturn={() => setReturnFormOpen(true)}
            onCancelReturn={() => setReturnFormOpen(false)}
          />
          {!actionIsAllowed && action !== 'pick' && (
            <span className="role-warning">
              {t('page.orderDetails.roleWarning', { role: requiredRoles.toLowerCase() })}
            </span>
          )}
          {action === 'pick' && role !== 'picker' && (
            <span className="role-warning">{t('page.orderDetails.pickerWarning')}</span>
          )}
        </div>
      ) : (
        <div className="complete-panel">
          <span>
            <Check size={16} />
          </span>
          <div>
            <strong>{t('page.orderDetails.returnComplete')}</strong>
            <p>{t('page.orderDetails.returnCompleteBody')}</p>
          </div>
        </div>
      )}
    </section>
  )
}
