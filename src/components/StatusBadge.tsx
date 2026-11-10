import type { OrderStatus } from '../types'
import { useContent } from '../content-model'

type StatusBadgeProps = { status: OrderStatus }

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useContent()
  return <span className={`status-badge status-${status}`}>{t(`status.${status}`)}</span>
}
