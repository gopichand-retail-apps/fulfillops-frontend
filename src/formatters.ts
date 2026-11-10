import type { FulfillmentOrder } from './types'
import type { Translate } from './content-model'

export function formatDeadline(value: string, t: Translate, now: number): string {
  const minutesRemaining = Math.round((Date.parse(value) - now) / 60_000)
  if (minutesRemaining < 0) return t('time.late', { count: Math.abs(minutesRemaining) })
  if (minutesRemaining < 60) return t('time.minutesLeft', { count: minutesRemaining })
  const hours = Math.floor(minutesRemaining / 60)
  const minutes = minutesRemaining % 60
  return t('time.hoursMinutesLeft', { hours, minutes })
}

export function formatTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function orderUnitCount(order: FulfillmentOrder): number {
  return order.items.reduce((total, item) => total + item.orderedQuantity, 0)
}

export function channelLabel(channel: FulfillmentOrder['channel'], t: Translate): string {
  return t(`channel.${channel}`)
}

export function returnReasonLabel(reason: NonNullable<FulfillmentOrder['returnInfo']>['reason'], t: Translate): string {
  return t(`returnReason.${reason}`)
}
