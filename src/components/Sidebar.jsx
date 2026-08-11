import {
  LogoMark,
  IconFolderOutline,
  IconBell,
  IconPlus,
  IconCheck,
  IconLogout,
  IconChevron,
  IconBulb,
  IconPin,
  IconTrash,
} from './Icons'
import { accounts, labels } from '../data'

export default function Sidebar({ view, onNavigate, variant = 'default' }) {
  const isNotes = variant === 'notes'

  return (
    <aside className={`sidebar ${isNotes ? 'sidebar-notes' : ''}`}>
      <button type="button" className="brand" onClick={() => onNavigate('projects')}>
        <LogoMark />
        <span>TaskPlate</span>
      </button>

      {isNotes ? (
        <>
          <nav className="nav">
            <button type="button" className="nav-item has-chevron" onClick={() => onNavigate('projects')}>
              <IconFolderOutline />
              <span>Projects</span>
              <IconChevron direction="down" />
            </button>
            <button type="button" className="nav-item has-chevron">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c1.5-3.5 4.2-5 8-5s6.5 1.5 8 5" />
              </svg>
              <span>Accounts</span>
              <IconChevron direction="down" />
            </button>
            <button type="button" className={`nav-item ${view === 'notes' ? 'active' : ''}`} onClick={() => onNavigate('notes')}>
              <IconBulb />
              <span>Notes</span>
            </button>
            <button type="button" className="nav-item">
              <IconPin size={16} />
              <span>Pinned</span>
            </button>
            <button type="button" className={`nav-item ${view === 'reminders' ? 'active' : ''}`} onClick={() => onNavigate('reminders')}>
              <IconBell />
              <span>Reminders</span>
            </button>
          </nav>

          <div className="sidebar-section labels-section">
            <div className="section-head">
              <span>LABELS</span>
              <button type="button" className="ghost-icon" aria-label="Add label">
                <IconPlus size={14} />
              </button>
            </div>
            <ul className="label-list">
              {labels.map((l) => (
                <li key={l.id}>
                  <button type="button" className="label-item">
                    <span className={`label-swatch tint-${l.color}`} />
                    {l.name}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="label-item new-label">
                  <span className="label-swatch dashed" />
                  New label
                </button>
              </li>
            </ul>
          </div>

          <div className="sidebar-footer">
            <button type="button" className="nav-item">
              <IconTrash />
              <span>Trash</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <nav className="nav">
            <button
              type="button"
              className={`nav-item ${view === 'projects' || view === 'notes' ? 'active' : ''}`}
              onClick={() => onNavigate('projects')}
            >
              <IconFolderOutline />
              <span>Projects</span>
            </button>
            <button
              type="button"
              className={`nav-item ${view === 'reminders' ? 'active' : ''}`}
              onClick={() => onNavigate('reminders')}
            >
              <IconBell />
              <span>Reminders</span>
            </button>
          </nav>

          <div className="sidebar-section">
            <div className="section-head">
              <span>ACCOUNTS</span>
              <IconChevron direction="down" />
            </div>
            <ul className="account-list">
              {accounts.map((a) => (
                <li key={a.id} className={a.active ? 'active' : ''}>
                  <div className="account">
                    <div className="account-avatar">
                      <img src={a.avatar} alt="" />
                      {a.active && <i className="online-dot" />}
                    </div>
                    <div className="account-meta">
                      <strong>{a.name}</strong>
                      <span>{a.email}</span>
                    </div>
                    {a.active && (
                      <span className="account-check">
                        <IconCheck />
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="account-action">
              <IconPlus size={14} />
              Add account
            </button>
            <button type="button" className="account-action">
              <IconLogout />
              Sign in
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
