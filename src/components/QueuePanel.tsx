import { Search, X } from 'lucide-react'
import { useContent } from '../content-model'
import type { QueueFilter, OrderView } from '../domain/order-views'
import type { FulfillmentOrder } from '../types'
import OrderRow from './OrderRow'

type QueuePanelProps = {
  view: OrderView
  queueFilter: QueueFilter
  search: string
  isLoading: boolean
  now: number
  visibleOrders: FulfillmentOrder[]
  queueOrders: FulfillmentOrder[]
  returns: FulfillmentOrder[]
  priorityOrders: FulfillmentOrder[]
  workingOrders: FulfillmentOrder[]
  selectedOrderId: string | null
  onSearchChange: (value: string) => void
  onFilterChange: (filter: QueueFilter) => void
  onSelectOrder: (orderId: string) => void
}

export default function QueuePanel({
  view,
  queueFilter,
  search,
  isLoading,
  now,
  visibleOrders,
  queueOrders,
  returns,
  priorityOrders,
  workingOrders,
  selectedOrderId,
  onSearchChange,
  onFilterChange,
  onSelectOrder,
}: QueuePanelProps) {
  const { t } = useContent()
  const totalOrders = view === 'returns' ? returns.length : queueOrders.length

  return (
    <section
      className="queue-panel"
      aria-label={view === 'returns' ? t('page.returnsQueue.title') : t('page.queue.ariaLabel')}
    >
      <div className="queue-header">
        <div>
          <div className="section-title-line">
            <h2>{view === 'returns' ? t('page.returnsQueue.title') : t('page.queue.title')}</h2>
            <span className="queue-total">{visibleOrders.length}</span>
          </div>
          <p>{view === 'returns' ? t('page.returnsQueue.subtitle') : t('page.queue.subtitle')}</p>
        </div>
        <div className="queue-live">
          <span /> {t('page.queue.live')}
        </div>
      </div>

      <label className="search-box">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder={t('page.queue.search')}
          aria-label={t('page.queue.search')}
        />
        {search && (
          <button type="button" onClick={() => onSearchChange('')} aria-label={t('action.clearSearch')}>
            <X size={15} />
          </button>
        )}
      </label>

      {view === 'queue' && (
        <div className="queue-filters" role="group" aria-label={t('page.queue.filterAriaLabel')}>
          <button type="button" aria-pressed={queueFilter === 'all'} onClick={() => onFilterChange('all')}>
            {t('page.queue.all')} <span>{queueOrders.length}</span>
          </button>
          <button type="button" aria-pressed={queueFilter === 'priority'} onClick={() => onFilterChange('priority')}>
            {t('page.queue.priority')} <span>{priorityOrders.length}</span>
          </button>
          <button type="button" aria-pressed={queueFilter === 'working'} onClick={() => onFilterChange('working')}>
            {t('page.queue.inProgress')} <span>{workingOrders.length}</span>
          </button>
        </div>
      )}

      <div className="queue-columns" aria-hidden="true">
        <span>{t('page.queue.columnOrder')}</span>
        <span>{t('page.queue.columnPromise')}</span>
        <span>{t('page.queue.columnStatus')}</span>
      </div>

      {isLoading && visibleOrders.length === 0 ? (
        <div className="loading-state" role="status">
          {t('page.queue.loading')}
        </div>
      ) : visibleOrders.length > 0 ? (
        <ul className="order-list">
          {visibleOrders.map((order) => (
            <li key={order.id}>
              <OrderRow order={order} now={now} selected={order.id === selectedOrderId} onSelect={onSelectOrder} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Search size={20} />
          </span>
          <strong>{view === 'returns' ? t('page.returnsQueue.emptyTitle') : t('page.queue.emptyTitle')}</strong>
          <p>{t('page.queue.emptyBody')}</p>
        </div>
      )}

      <div className="queue-footer">
        <span>
          <span className="footer-dot" /> {t('page.queue.seeded')}
        </span>
        <span>{t('page.queue.showing', { visible: visibleOrders.length, total: totalOrders })}</span>
      </div>
    </section>
  )
}
