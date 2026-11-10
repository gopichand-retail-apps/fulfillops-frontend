import { ArrowRight, Clock3, MapPin } from 'lucide-react'
import { channelLabel, formatDeadline, orderUnitCount } from '../formatters'
import { useContent } from '../content-model'
import type { FulfillmentOrder } from '../types'
import StatusBadge from './StatusBadge'

type OrderRowProps = {
  order: FulfillmentOrder
  now: number
  selected: boolean
  onSelect: (orderId: string) => void
}

export default function OrderRow({ order, now, selected, onSelect }: OrderRowProps) {
  const { t } = useContent()
  const deadline = formatDeadline(order.promisedAt, t, now)
  const isLate = Date.parse(order.promisedAt) < now

  return (
    <button
      className={selected ? 'order-row selected' : 'order-row'}
      type="button"
      onClick={() => onSelect(order.id)}
      aria-current={selected ? 'true' : undefined}
      aria-label={t('page.queue.rowLabel', {
        orderNumber: order.orderNumber,
        status: t(`status.${order.status}`),
        priority: t(`priority.${order.priority}Label`),
      })}
    >
      <span className="row-order">
        <span className={`priority-mark priority-${order.priority}`} />
        <span className="row-order-copy">
          <strong>{order.orderNumber}</strong>
          <span>
            {channelLabel(order.channel, t)} <span className="row-separator">·</span>{' '}
            {t('page.queue.units', { count: orderUnitCount(order) })}
          </span>
        </span>
      </span>
      <span className={isLate ? 'row-promise late' : 'row-promise'}>
        <Clock3 size={14} aria-hidden="true" />
        <span>{deadline}</span>
      </span>
      <span className="row-status">
        <StatusBadge status={order.status} />
        <ArrowRight size={15} className="row-arrow" aria-hidden="true" />
      </span>
      <span className="row-location">
        <MapPin size={12} /> {order.zone}
      </span>
    </button>
  )
}
