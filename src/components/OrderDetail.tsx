import { ArrowLeft, Clock3, MapPin, ShieldCheck, Truck } from 'lucide-react'
import type { OrderActionInput } from '../api'
import { channelLabel, formatDeadline, formatTime } from '../formatters'
import { useContent } from '../content-model'
import type { DemoRole, FulfillmentOrder } from '../types'
import StatusBadge from './StatusBadge'
import { OrderActionPanel, OrderItems, OrderProgress } from './OrderDetailSections'

type OrderDetailProps = {
  order: FulfillmentOrder
  now: number
  role: DemoRole
  pendingAction: string | null
  mobileOpen: boolean
  onBack: () => void
  onAction: (action: OrderActionInput) => void
}

export default function OrderDetail({
  order,
  now,
  role,
  pendingAction,
  mobileOpen,
  onBack,
  onAction,
}: OrderDetailProps) {
  const { model, t } = useContent()
  const isLate = Date.parse(order.promisedAt) < now

  return (
    <section
      className={mobileOpen ? 'detail-panel mobile-visible' : 'detail-panel'}
      aria-label={t('page.orderDetails.label', { orderNumber: order.orderNumber })}
    >
      <div className="detail-heading">
        <button className="detail-back" type="button" onClick={onBack} aria-label={t('action.backToQueue')}>
          <ArrowLeft size={17} />
        </button>
        <div>
          <p className="eyebrow">{t('page.orderDetails.eyebrow')}</p>
          <div className="detail-title-row">
            <h2>{order.orderNumber}</h2>
            <StatusBadge status={order.status} />
          </div>
        </div>
        <span className={`priority-label priority-text-${order.priority}`}>
          <span className={`priority-mark priority-${order.priority}`} />
          {t(`priority.${order.priority}`)}
        </span>
      </div>

      <div className="order-meta-grid">
        <div>
          <span>{t('page.orderDetails.channel')}</span>
          <strong>{channelLabel(order.channel, t)}</strong>
        </div>
        <div>
          <span>{t('page.orderDetails.zone')}</span>
          <strong>
            <MapPin size={13} /> {order.zone}
          </strong>
        </div>
        <div className={isLate ? 'promise-meta late' : 'promise-meta'}>
          <span>{t('page.orderDetails.promise')}</span>
          <strong>
            <Clock3 size={13} /> {formatDeadline(order.promisedAt, t, now)}
          </strong>
        </div>
      </div>

      {order.shipment && (
        <section className="shipment-reference" aria-label={t('page.orderDetails.shipmentLabel')}>
          <span className="shipment-reference-icon">
            <Truck size={16} aria-hidden="true" />
          </span>
          <div className="shipment-reference-details">
            <span>
              {order.shipment.carrier} · {t('page.orderDetails.simulated')}
            </span>
            <strong>{order.shipment.trackingNumber}</strong>
          </div>
          <time dateTime={order.shipment.shippedAt}>{formatTime(order.shipment.shippedAt, model.locale)}</time>
        </section>
      )}

      <OrderProgress order={order} />
      <OrderItems order={order} role={role} pendingAction={pendingAction} onAction={onAction} />
      <OrderActionPanel order={order} role={role} pendingAction={pendingAction} onAction={onAction} />

      <div className="detail-footnote">
        <ShieldCheck size={14} /> {t('page.orderDetails.roleDisclaimer')}
      </div>
    </section>
  )
}
