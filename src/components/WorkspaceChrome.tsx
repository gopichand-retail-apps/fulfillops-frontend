import { ClipboardList, PackageCheck, RotateCcw, Warehouse } from 'lucide-react'
import { APP_VERSION } from '../app-version'
import { useContent } from '../content-model'
import type { OrderView } from '../domain/order-views'
import type { DemoProfile, DemoRole } from '../types'

type WorkspaceSidebarProps = {
  view: OrderView
  queueCount: number
  returnCount: number
  warehouseName: string
  warehouseCode: string
  onChange: (view: OrderView) => void
}

export function WorkspaceSidebar({
  view,
  queueCount,
  returnCount,
  warehouseName,
  warehouseCode,
  onChange,
}: WorkspaceSidebarProps) {
  const { t } = useContent()

  return (
    <aside className="sidebar">
      <a className="brand" href="#queue" aria-label={t('app.home')}>
        <span className="brand-mark">
          <PackageCheck size={20} aria-hidden="true" />
        </span>
        <span>{t('app.name')}</span>
      </a>
      <p className="sidebar-label">{t('app.floor')}</p>
      <nav className="side-nav" aria-label={t('navigation.primary')}>
        <button
          className={view === 'queue' ? 'side-link active' : 'side-link'}
          onClick={() => onChange('queue')}
          type="button"
        >
          <ClipboardList size={17} aria-hidden="true" />
          <span>{t('navigation.queue')}</span>
          <span className="nav-count">{queueCount}</span>
        </button>
        <button
          className={view === 'returns' ? 'side-link active' : 'side-link'}
          onClick={() => onChange('returns')}
          type="button"
        >
          <RotateCcw size={17} aria-hidden="true" />
          <span>{t('navigation.returns')}</span>
          <span className="nav-count">{returnCount}</span>
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="warehouse-stamp">
          <span className="stamp-icon">
            <Warehouse size={16} aria-hidden="true" />
          </span>
          <span>
            <strong>{warehouseName}</strong>
            <small>{warehouseCode}</small>
          </span>
        </div>
        <div className="environment-label">
          <span /> {t('app.synthetic')}
        </div>
        <small className="app-version">{t('app.releaseVersion', { version: APP_VERSION })}</small>
      </div>
    </aside>
  )
}

type WorkspaceHeaderProps = {
  warehouseName: string
  view: OrderView
  isOnline: boolean
  role: DemoRole
  profiles: DemoProfile[]
  rolesLoading: boolean
  onProfileChange: (profileId: string) => void
  onViewChange: (view: OrderView) => void
}

export function WorkspaceHeader({
  warehouseName,
  view,
  isOnline,
  role,
  profiles,
  rolesLoading,
  onProfileChange,
  onViewChange,
}: WorkspaceHeaderProps) {
  const { t } = useContent()

  return (
    <>
      <header className="topbar">
        <div className="topbar-location">
          <span className="topbar-kicker">{t('app.operations', { warehouse: warehouseName })}</span>
          <span className="topbar-divider" aria-hidden="true">
            /
          </span>
          <span className="topbar-current">{t('app.fulfillment')}</span>
        </div>
        <div className="topbar-tools">
          <span className={isOnline ? 'connection-pill online' : 'connection-pill offline'}>
            <span className="connection-dot" />
            {isOnline ? t('connection.connected') : t('connection.offline')}
          </span>
          <small className="app-version">{t('app.releaseVersion', { version: APP_VERSION })}</small>
          <label className="role-field" htmlFor="demo-role">
            <span>{t('role.simulation')}</span>
            <select
              id="demo-role"
              value={role}
              disabled={rolesLoading || profiles.length === 0}
              onChange={(event) => onProfileChange(event.currentTarget.value)}
            >
              {profiles.map((profile) => (
                <option value={profile.id} key={profile.id}>
                  {t(`role.${profile.role}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <nav className="mobile-nav" aria-label={t('navigation.primary')}>
        <button
          className={view === 'queue' ? 'mobile-nav-link active' : 'mobile-nav-link'}
          onClick={() => onViewChange('queue')}
          type="button"
        >
          <ClipboardList size={16} /> {t('navigation.queue')}
        </button>
        <button
          className={view === 'returns' ? 'mobile-nav-link active' : 'mobile-nav-link'}
          onClick={() => onViewChange('returns')}
          type="button"
        >
          <RotateCcw size={16} /> {t('navigation.returns')}
        </button>
      </nav>
    </>
  )
}
