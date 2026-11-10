import { AlertTriangle, ArrowUpRight, ClipboardList, PackageCheck, RefreshCw, Warehouse } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { getOrders, getReturns, getSummary } from './api'
import { displayApiError } from './api-errors'
import { isMock } from './config'
import './App.css'
import OrderDetail from './components/OrderDetail'
import QueuePanel from './components/QueuePanel'
import StatusMessages from './components/StatusMessages'
import { WorkspaceHeader, WorkspaceSidebar } from './components/WorkspaceChrome'
import { dataString, useContent } from './content-model'
import { deriveOrderViews } from './domain/order-views'
import type { QueueFilter, OrderView } from './domain/order-views'
import { useDemoSession } from './hooks/use-demo-session'
import { useFulfillmentAction } from './hooks/use-fulfillment-action'
import type { FulfillmentOrder, WorkflowSummary } from './types'

type AppProps = { initialNow: number }

const emptySummary: WorkflowSummary = {
  openOrders: 0,
  readyToPick: 0,
  packedToday: 0,
  slaAtRisk: 0,
}

function App({ initialNow }: AppProps) {
  const { model, t } = useContent()
  const { profiles, role, rolesLoading, authError, changeProfile } = useDemoSession({
    t,
    messages: model.messages,
  })
  const [now, setNow] = useState(initialNow)
  const warehouseName = dataString(model, 'warehouseName')
  const warehouseCode = dataString(model, 'warehouseCode')
  const warehouseId = dataString(model, 'warehouseId')
  const shift = dataString(model, 'shift')
  const dateLabel = new Intl.DateTimeFormat(model.locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now)
  const [orders, setOrders] = useState<FulfillmentOrder[]>([])
  const [returns, setReturns] = useState<FulfillmentOrder[]>([])
  const [summary, setSummary] = useState(emptySummary)
  const [view, setView] = useState<OrderView>('queue')
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [selectedOrderId, setSelectedOrderId] = useState('FO-48291')
  const [reloadVersion, setReloadVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    Promise.all([
      getOrders(deferredSearch, controller.signal),
      getReturns(controller.signal),
      getSummary(controller.signal),
    ])
      .then(([nextOrders, nextReturns, nextSummary]) => {
        if (!active) return
        setOrders(nextOrders)
        setReturns(nextReturns)
        setSummary(nextSummary)
        setIsOnline(true)
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return
        setIsOnline(false)
        setLoadError(displayApiError(error, t, model.messages))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [deferredSearch, model.messages, reloadVersion, t])

  const { queueOrders, priorityOrders, workingOrders, visibleOrders } = deriveOrderViews({
    orders,
    returns,
    query: deferredSearch,
    view,
    queueFilter,
  })
  const selectedOrder = visibleOrders.find((order) => order.id === selectedOrderId) ?? visibleOrders[0] ?? null

  function refreshData() {
    setIsLoading(true)
    setLoadError(null)
    setReloadVersion((version) => version + 1)
  }

  function chooseView(nextView: OrderView) {
    setView(nextView)
    setMobileDetailOpen(false)
  }

  const { pendingAction, notice, setNotice, runAction } = useFulfillmentAction({
    order: selectedOrder,
    refreshData,
  })

  return (
    <div className="app-shell" data-mode={isMock ? 'mock' : 'live'}>
      <WorkspaceSidebar
        view={view}
        queueCount={queueOrders.length}
        returnCount={returns.length}
        warehouseName={warehouseName}
        warehouseCode={warehouseCode}
        onChange={chooseView}
      />

      <div className="app-body">
        <WorkspaceHeader
          warehouseName={warehouseName}
          isOnline={isOnline}
          role={role}
          view={view}
          profiles={profiles}
          rolesLoading={rolesLoading}
          onProfileChange={(profileId) => void changeProfile(profileId)}
          onViewChange={chooseView}
        />

        <main className="main-content" id="queue">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {dateLabel} <span>·</span> {t('app.shift', { shift })}
              </p>
              <h1>{view === 'returns' ? t('page.returns.title') : t('page.floor.title')}</h1>
              <p className="page-subtitle">
                {view === 'returns' ? t('page.returns.subtitle') : t('page.floor.subtitle')}
              </p>
            </div>
            <button
              className="refresh-button"
              onClick={refreshData}
              type="button"
              title={t('action.refreshWarehouse')}
              aria-label={t('action.refreshWarehouse')}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} aria-hidden="true" />
              <span>{t('action.refresh')}</span>
            </button>
          </div>

          <section className="metric-strip" aria-label={t('page.summary.label')}>
            <Metric
              label={t('metric.openOrders')}
              value={summary.openOrders}
              icon={<ClipboardList size={16} />}
              tone="green"
            />
            <Metric
              label={t('metric.readyToPick')}
              value={summary.readyToPick}
              icon={<ArrowUpRight size={16} />}
              tone="lime"
            />
            <Metric
              label={t('metric.packedToday')}
              value={summary.packedToday}
              icon={<PackageCheck size={16} />}
              tone="blue"
            />
            <Metric
              label={t('metric.slaAtRisk')}
              value={summary.slaAtRisk}
              icon={<AlertTriangle size={16} />}
              tone="coral"
            />
          </section>

          <StatusMessages
            loadError={loadError}
            authError={authError}
            notice={notice}
            onRetryData={refreshData}
            onRetrySession={() => window.location.reload()}
            onDismissNotice={() => setNotice(null)}
          />

          <section className={mobileDetailOpen ? 'workbench detail-open' : 'workbench'}>
            <QueuePanel
              view={view}
              queueFilter={queueFilter}
              search={search}
              isLoading={isLoading}
              now={now}
              visibleOrders={visibleOrders}
              queueOrders={queueOrders}
              returns={returns}
              priorityOrders={priorityOrders}
              workingOrders={workingOrders}
              selectedOrderId={selectedOrder?.id ?? null}
              onSearchChange={(nextSearch) => {
                setIsLoading(true)
                setLoadError(null)
                setSearch(nextSearch)
              }}
              onFilterChange={setQueueFilter}
              onSelectOrder={(orderId) => {
                setSelectedOrderId(orderId)
                setMobileDetailOpen(true)
              }}
            />

            {selectedOrder ? (
              <OrderDetail
                order={selectedOrder}
                now={now}
                role={role}
                pendingAction={pendingAction}
                mobileOpen={mobileDetailOpen}
                onBack={() => setMobileDetailOpen(false)}
                onAction={(action) => {
                  void runAction(action)
                }}
              />
            ) : (
              <section className="detail-empty">
                <span className="detail-empty-icon">
                  <PackageCheck size={25} />
                </span>
                <h2>{t('page.detailEmpty.title')}</h2>
                <p>{t('page.detailEmpty.body')}</p>
              </section>
            )}
          </section>

          <footer className="page-footer">
            <span>
              <Warehouse size={14} /> {warehouseName} <span className="footer-divider">/</span> {warehouseId}
            </span>
            <span>
              <span className="footer-dot" /> {t('footer.demo')}
            </span>
          </footer>
        </main>
      </div>
    </div>
  )
}

type MetricProps = { label: string; value: number; icon: React.ReactNode; tone: string }

function Metric({ label, value, icon, tone }: MetricProps) {
  return (
    <div className="metric-item">
      <span className={`metric-icon ${tone}`}>{icon}</span>
      <div>
        <span className="metric-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

export default App
