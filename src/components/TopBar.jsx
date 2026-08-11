import { IconSearch, IconHelp, IconSettings, IconApps } from './Icons'

export default function TopBar({ user }) {
  return (
    <header className="topbar">
      <div className="search">
        <IconSearch />
        <input type="search" placeholder="Search projects, notes, or tasks..." aria-label="Search" />
      </div>
      <div className="topbar-actions">
        <button type="button" className="icon-btn" aria-label="Help">
          <IconHelp />
        </button>
        <button type="button" className="icon-btn" aria-label="Settings">
          <IconSettings />
        </button>
        <button type="button" className="icon-btn" aria-label="Apps">
          <IconApps />
        </button>
        <button type="button" className="profile-btn" aria-label="Profile">
          <img src={user.avatar} alt={user.name} />
        </button>
      </div>
    </header>
  )
}
