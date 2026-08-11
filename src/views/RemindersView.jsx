import { useState } from 'react'
import {
  reminderTabs,
  reminderGroups,
  overviewStats,
  quickFilters,
} from '../data'
import { AvatarStack } from '../components/Avatar'
import {
  IconPlus,
  IconCalendar,
  IconClock,
  IconCheckCircle,
  IconMore,
  IconChevron,
  IconUser,
  IconFlag,
} from '../components/Icons'

const tabIcons = {
  today: IconCalendar,
  upcoming: IconCalendar,
  overdue: IconClock,
  completed: IconCheckCircle,
}

const filterIcons = {
  assigned: IconUser,
  nodate: IconCalendar,
  priority: IconFlag,
}

function CalendarWidget() {
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  const cells = [
    '', '', '', 1, 2, 3, 4,
    5, 6, 7, 8, 9, 10, 11,
    12, 13, 14, 15, 16, 17, 18,
    19, 20, 21, 22, 23, 24, 25,
    26, 27, 28, 29, 30, 31, '',
  ]

  return (
    <div className="widget calendar-widget">
      <div className="widget-head">
        <h3>Calendar</h3>
      </div>
      <div className="cal-nav">
        <strong>May 2024</strong>
        <div>
          <button type="button" aria-label="Previous month"><IconChevron direction="left" /></button>
          <button type="button" aria-label="Next month"><IconChevron direction="right" /></button>
        </div>
      </div>
      <div className="cal-grid">
        {days.map((d) => (
          <span key={d} className="cal-dow">{d}</span>
        ))}
        {cells.map((d, i) => (
          <span key={i} className={`cal-day ${d === 10 ? 'today' : ''} ${d === '' ? 'empty' : ''}`}>
            {d}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function RemindersView() {
  const [activeTab, setActiveTab] = useState('today')
  const [checked, setChecked] = useState({})

  return (
    <div className="reminders-layout">
      <div className="page reminders-page">
        <div className="page-header">
          <div>
            <h1>Reminders</h1>
            <p className="subtitle">Stay on top of important tasks across projects.</p>
          </div>
          <button type="button" className="btn-primary">
            <IconPlus size={16} />
            New Reminder
          </button>
        </div>

        <div className="status-tabs">
          {reminderTabs.map((tab) => {
            const Icon = tabIcons[tab.id]
            return (
              <button
                key={tab.id}
                type="button"
                className={`status-tab ${activeTab === tab.id ? 'active' : ''} tint-${tab.color}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className={`status-icon tint-${tab.color}`}>
                  <Icon size={18} />
                </span>
                <span className="status-label">{tab.label}</span>
                <span className={`status-count tint-${tab.color}`}>{tab.count}</span>
              </button>
            )
          })}
        </div>

        <div className="reminder-groups">
          {reminderGroups.map((group) => (
            <section key={group.id} className="reminder-group">
              <div className="group-head">
                <h2>
                  {group.title}
                  {group.date ? ` · ${group.date}` : ''}
                </h2>
                <span>{group.count} reminder{group.count === 1 ? '' : 's'}</span>
              </div>
              <ul className="reminder-list">
                {group.items.map((item) => (
                  <li key={item.id} className={`reminder-row accent-${item.accent} ${item.overdue ? 'overdue' : ''}`}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={!!checked[item.id]}
                        onChange={() =>
                          setChecked((c) => ({ ...c, [item.id]: !c[item.id] }))
                        }
                      />
                      <span />
                    </label>
                    <div className="reminder-main">
                      <strong className={checked[item.id] ? 'done' : ''}>{item.title}</strong>
                      <span className={`reminder-time ${item.overdue ? 'overdue' : ''}`}>
                        <IconClock size={13} />
                        {item.time}
                      </span>
                    </div>
                    <span className={`tag tint-${item.tagColor}`}>{item.tag}</span>
                    <AvatarStack people={item.assignees} size={24} />
                    <button type="button" className="icon-btn sm" aria-label="More">
                      <IconMore />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <aside className="right-rail">
        <div className="widget overview-widget">
          <h3>Overview</h3>
          <div className="overview-cards">
            {overviewStats.map((s) => (
              <div key={s.id} className={`overview-card tint-${s.color}`}>
                <span className={`overview-icon tint-${s.color}`}>
                  {s.id === 'done' ? <IconCheckCircle size={16} /> : <IconCalendar size={16} />}
                </span>
                <div>
                  <span>{s.label}</span>
                  <strong>{s.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        <CalendarWidget />

        <div className="widget filters-widget">
          <h3>Quick Filters</h3>
          <ul>
            {quickFilters.map((f) => {
              const Icon = filterIcons[f.id]
              return (
                <li key={f.id}>
                  <button type="button" className="filter-row">
                    <span>
                      <Icon size={15} />
                      {f.label}
                    </span>
                    <em>{f.count}</em>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
    </div>
  )
}
