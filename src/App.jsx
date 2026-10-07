import { useMemo, useState } from 'react'
import {
  clients,
  bookedByClient,
  initialSavedSessions,
  sessionTypes,
  therapists,
  handsOptions,
  staffDirectory,
} from './data'
import './App.css'

const EDIT_WINDOW_MS = 36 * 60 * 60 * 1000

function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatLongDate(date) {
  return new Date(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMoney(n) {
  return `Rs ${Number(n).toLocaleString()}`
}

function canEdit(session) {
  return Date.now() - new Date(session.dateTime).getTime() < EDIT_WINDOW_MS
}

/** Booked/unused pull-ins: any valid staff may edit. Otherwise only the creating code. */
function isFromUnusedBooking(session) {
  return session?.source === 'booked'
}

function staffMayEdit(session, staff) {
  if (!session || !staff) return false
  if (isFromUnusedBooking(session)) return true
  return session.staffCode?.toUpperCase() === staff.code.toUpperCase()
}

function nextCycleLabel(client) {
  const next = Math.min(client.cycleCurrent + 1, client.cycleTotal)
  return `${next} / ${client.cycleTotal}`
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '')
}

function resolveStaff(code) {
  const normalized = String(code || '').trim().toUpperCase()
  if (!normalized) return null
  return staffDirectory.find((s) => s.code.toUpperCase() === normalized) || null
}

function emptyForm(client) {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
  return {
    dateTime: local,
    sessionType: sessionTypes[0],
    cycle: client ? nextCycleLabel(client) : '',
    sex: client?.sex || 'M',
    amount: '',
    settled: true,
    bonus: '0',
    lunez: '0',
    therapists: [therapists[0]],
    hands: '2',
    comments: '',
    staffCode: '',
  }
}

function emptyClientForm() {
  return {
    name: '',
    phone: '',
    sex: 'M',
    badge: 'New Client',
    cycleTotal: '4',
    staffCode: '',
  }
}

function initialsFrom(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function App() {
  const [clientList, setClientList] = useState(clients)
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState([])
  const [client, setClient] = useState(null)
  const [booked, setBooked] = useState({})
  const [saved, setSaved] = useState(initialSavedSessions)
  const [panel, setPanel] = useState(null) // 'session' | 'booked' | 'note' | 'create' | null
  const [form, setForm] = useState(emptyForm(null))
  const [clientForm, setClientForm] = useState(emptyClientForm())
  const [editingId, setEditingId] = useState(null)
  const [note, setNote] = useState('')
  const [noteSent, setNoteSent] = useState(false)
  const [dateFilter, setDateFilter] = useState('today') // today | yesterday | pick
  const [pickedDate, setPickedDate] = useState(() => todayISO().toISOString().slice(0, 10))
  const [bookedStaffCode, setBookedStaffCode] = useState('')
  const [toast, setToast] = useState('')

  const clientBookings = client ? booked[client.id] || bookedByClient[client.id] || [] : []
  const editingSession = editingId ? saved.find((s) => s.id === editingId) : null

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  function requireStaff(code) {
    const staff = resolveStaff(code)
    if (!staff) {
      showToast('Enter a valid staff unique code')
      return null
    }
    return staff
  }

  function runSearch(e) {
    e?.preventDefault()
    const q = query.trim().toLowerCase()
    setSearched(true)
    setClient(null)
    setPanel(null)
    setEditingId(null)
    setNoteSent(false)

    if (!q) {
      setResults([])
      return
    }

    const qDigits = digitsOnly(q)
    const found = clientList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && c.phoneDigits.includes(qDigits)) ||
        c.phone.toLowerCase().includes(q),
    )
    setResults(found)
  }

  function openCreateClient() {
    setClient(null)
    setResults([])
    setEditingId(null)
    setClientForm(emptyClientForm())
    setPanel('create')
  }

  function createClient(e) {
    e?.preventDefault()
    const name = clientForm.name.trim()
    const phone = clientForm.phone.trim()
    const staff = resolveStaff(clientForm.staffCode)
    if (!staff) {
      showToast('Enter a valid staff unique code')
      return
    }
    if (!name || !phone) {
      showToast('Name and phone are required')
      return
    }
    const phoneDigits = digitsOnly(phone)
    if (phoneDigits.length < 7) {
      showToast('Enter a valid phone number')
      return
    }
    const duplicate = clientList.find(
      (c) => c.phoneDigits === phoneDigits || c.name.toLowerCase() === name.toLowerCase(),
    )
    if (duplicate) {
      showToast('Client already exists — search instead')
      return
    }

    const cycleTotal = Math.max(1, Number(clientForm.cycleTotal) || 4)
    const newClient = {
      id: `c-${Date.now()}`,
      name,
      phone,
      phoneDigits,
      initials: initialsFrom(name),
      badge: clientForm.badge || 'New Client',
      sex: clientForm.sex,
      cycleCurrent: 0,
      cycleTotal,
      totalSessions: 0,
      completed: 0,
      upcoming: 0,
      createdByCode: staff.code,
      createdByName: staff.name,
    }

    setClientList((list) => [newClient, ...list])
    setBooked((prev) => ({ ...prev, [newClient.id]: [] }))
    setPanel(null)
    setClientForm(emptyClientForm())
    selectClient(newClient)
    showToast(`Client created by ${staff.name}`)
  }

  function selectClient(c) {
    setClient(c)
    setResults([])
    setPanel(null)
    setForm(emptyForm(c))
    setEditingId(null)
    setNote('')
    setNoteSent(false)
    if (!booked[c.id]) {
      setBooked((prev) => ({ ...prev, [c.id]: [...(bookedByClient[c.id] || [])] }))
    }
  }

  function openAddSession() {
    if (!client) return
    setEditingId(null)
    setForm(emptyForm(client))
    setPanel('session')
  }

  function openBooked() {
    setBookedStaffCode('')
    setPanel('booked')
  }

  function openNote() {
    setNoteSent(false)
    setPanel('note')
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleTherapist(name) {
    setForm((f) => {
      const has = f.therapists.includes(name)
      const next = has ? f.therapists.filter((t) => t !== name) : [...f.therapists, name]
      return { ...f, therapists: next.length ? next : f.therapists }
    })
  }

  function saveSession(e) {
    e?.preventDefault()
    if (!client && !editingId) return
    const staff = requireStaff(form.staffCode)
    if (!staff) return
    if (!form.amount || Number(form.amount) <= 0) {
      showToast('Enter a valid amount')
      return
    }
    if (!form.therapists.length) {
      showToast('Assign at least one therapist')
      return
    }

    const dateTime = new Date(form.dateTime).toISOString()

    if (editingId) {
      const existing = saved.find((s) => s.id === editingId)
      if (!existing) {
        showToast('Session not found')
        return
      }
      if (!canEdit(existing)) {
        showToast('Edit unavailable after 36 hrs')
        return
      }
      if (!staffMayEdit(existing, staff)) {
        showToast(
          `Only ${existing.staffName || 'the creating staff'} (${existing.staffCode}) can edit this session`,
        )
        return
      }

      setSaved((list) =>
        list.map((s) =>
          s.id === editingId
            ? {
                ...s,
                dateTime,
                sessionType: form.sessionType,
                cycle: form.cycle,
                amount: Number(form.amount),
                settled: form.settled,
                bonus: Number(form.bonus) || 0,
                lunez: Number(form.lunez) || 0,
                therapists: form.therapists,
                hands: form.hands,
                sex: form.sex,
                comments: form.comments,
                // Keep original creator; record who last updated
                updatedByCode: staff.code,
                updatedByName: staff.name,
              }
            : s,
        ),
      )
      showToast(`Session updated by ${staff.name}`)
      setEditingId(null)
      setPanel(null)
      return
    }

    const row = {
      id: `s-${Date.now()}`,
      clientId: client.id,
      clientName: client.name,
      dateTime,
      sessionType: form.sessionType,
      cycle: form.cycle,
      amount: Number(form.amount),
      settled: form.settled,
      bonus: Number(form.bonus) || 0,
      lunez: Number(form.lunez) || 0,
      therapists: form.therapists,
      hands: form.hands,
      sex: form.sex,
      comments: form.comments,
      status: 'Pending',
      source: 'new',
      staffCode: staff.code,
      staffName: staff.name,
    }

    setSaved((list) => [row, ...list])
    setClient((c) =>
      c
        ? {
            ...c,
            cycleCurrent: Math.min(c.cycleCurrent + 1, c.cycleTotal),
            totalSessions: c.totalSessions + 1,
            upcoming: Math.max(0, c.upcoming),
          }
        : c,
    )
    setForm(emptyForm({ ...client, cycleCurrent: Math.min(client.cycleCurrent + 1, client.cycleTotal) }))
    setPanel(null)
    setDateFilter('today')
    showToast(`Session saved by ${staff.name}`)
  }

  function addBookedToSessions(booking) {
    if (!client) return
    const staff = requireStaff(bookedStaffCode)
    if (!staff) return
    const now = new Date()
    const row = {
      id: `s-${Date.now()}`,
      clientId: client.id,
      clientName: client.name,
      dateTime: now.toISOString(),
      sessionType: booking.sessionType,
      cycle: booking.cycle,
      amount: booking.amount,
      settled: false,
      bonus: booking.bonus || 0,
      lunez: booking.lunez || 0,
      therapists: booking.therapists,
      hands: booking.hands,
      sex: booking.sex || client.sex,
      comments: `From booking ${booking.date}`,
      status: 'Pending',
      source: 'booked',
      bookingId: booking.id,
      staffCode: staff.code,
      staffName: staff.name,
    }

    setSaved((list) => [row, ...list])
    setBooked((prev) => ({
      ...prev,
      [client.id]: (prev[client.id] || []).filter((b) => b.id !== booking.id),
    }))
    setBookedStaffCode('')
    setDateFilter('today')
    showToast(`Booked session added by ${staff.name}`)
  }

  function startEdit(session) {
    if (!canEdit(session)) {
      showToast('Edit unavailable after 36 hrs')
      return
    }
    const local = new Date(new Date(session.dateTime).getTime() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setEditingId(session.id)
    setClient(clientList.find((c) => c.id === session.clientId) || client)
    setForm({
      dateTime: local,
      sessionType: session.sessionType,
      cycle: session.cycle,
      sex: session.sex || 'M',
      amount: String(session.amount),
      settled: session.settled,
      bonus: String(session.bonus ?? 0),
      lunez: String(session.lunez ?? 0),
      therapists: session.therapists,
      hands: session.hands,
      comments: session.comments || '',
      staffCode: '',
    })
    setPanel('session')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function completeClient(session) {
    setSaved((list) =>
      list.map((s) => (s.id === session.id ? { ...s, status: 'Completed', settled: true } : s)),
    )
    showToast(`${session.clientName} marked complete`)
  }

  function sendNote(e) {
    e?.preventDefault()
    if (!note.trim()) {
      showToast('Write a note first')
      return
    }
    setNoteSent(true)
    setNote('')
    showToast('Note sent to admin')
  }

  const filterDate = useMemo(() => {
    if (dateFilter === 'today') return todayISO()
    if (dateFilter === 'yesterday') {
      const d = todayISO()
      d.setDate(d.getDate() - 1)
      return d
    }
    return startOfDay(pickedDate)
  }, [dateFilter, pickedDate])

  const filteredSaved = useMemo(() => {
    return saved
      .filter((s) => startOfDay(s.dateTime).getTime() === filterDate.getTime())
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
  }, [saved, filterDate])

  return (
    <div className="fd">
      <header className="fd-header">
        <div className="brand">
          <span className="lotus" aria-hidden="true">
            ❀
          </span>
          <div>
            <strong>Zura Brain</strong>
            <span className="sep">|</span>
            <span>Front Desk</span>
          </div>
        </div>
        <p className="tagline">Wellness · Business · Made Simple</p>
        <div className="user">
          <span className="avatar">FD</span>
          <span>Front Desk</span>
        </div>
      </header>

      <main className="fd-main">
        <form className="search-card" onSubmit={runSearch}>
          <div className="search-row">
            <span className="search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client by name or phone number"
              aria-label="Search client"
            />
            <button type="submit" className="btn primary">
              Search
            </button>
            <button type="button" className="btn outline" onClick={openCreateClient}>
              + Create Client
            </button>
          </div>
          <div className="info-banner">
            <span className="info-i">i</span>
            Search an existing client, or create a new one if they are not in the system.
          </div>
        </form>

        {searched && !client && results.length === 0 && panel !== 'create' && (
          <div className="empty-card">
            <h2>No client found</h2>
            <p>Try another name or phone, or create a new client.</p>
            <button type="button" className="btn primary" onClick={openCreateClient}>
              + Create Client
            </button>
          </div>
        )}

        {panel === 'create' && (
          <section className="card panel-card">
            <div className="panel-head">
              <h2>Create Client</h2>
              <button type="button" className="text-btn" onClick={() => setPanel(null)}>
                Close
              </button>
            </div>
            <form className="session-form create-form" onSubmit={createClient}>
              <label>
                Full name
                <input
                  value={clientForm.name}
                  onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Imran Khan"
                  required
                />
              </label>
              <label>
                Phone number
                <input
                  value={clientForm.phone}
                  onChange={(e) => setClientForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+92 300 000 0000"
                  required
                />
              </label>
              <fieldset className="seg">
                <legend>Sex</legend>
                {['M', 'F', 'Other'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={clientForm.sex === s ? 'active' : ''}
                    onClick={() => setClientForm((f) => ({ ...f, sex: s }))}
                  >
                    {s}
                  </button>
                ))}
              </fieldset>
              <label>
                Badge
                <select
                  value={clientForm.badge}
                  onChange={(e) => setClientForm((f) => ({ ...f, badge: e.target.value }))}
                >
                  <option>New Client</option>
                  <option>Regular Client</option>
                  <option>VIP</option>
                </select>
              </label>
              <label>
                Cycle length
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={clientForm.cycleTotal}
                  onChange={(e) => setClientForm((f) => ({ ...f, cycleTotal: e.target.value }))}
                />
              </label>
              <label className="staff-code-field">
                Staff unique code
                <input
                  type="password"
                  autoComplete="off"
                  value={clientForm.staffCode}
                  onChange={(e) => setClientForm((f) => ({ ...f, staffCode: e.target.value }))}
                  placeholder="e.g. FD-1001"
                  required
                />
                <span className="field-hint">Required — identifies who created this client</span>
              </label>
              <div className="form-actions full">
                <button type="button" className="btn ghost" onClick={() => setPanel(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save Client
                </button>
              </div>
            </form>
          </section>
        )}

        {results.length > 0 && !client && (
          <section className="card results-card">
            <h2>Search results</h2>
            <ul className="result-list">
              {results.map((c) => (
                <li key={c.id}>
                  <button type="button" className="result-row" onClick={() => selectClient(c)}>
                    <span className="avatar lg">{c.initials}</span>
                    <span className="result-meta">
                      <strong>{c.name}</strong>
                      <em>{c.phone}</em>
                    </span>
                    <span className="badge soft">{c.badge}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {client && (
          <section className="card client-card">
            <div className="client-top">
              <div className="client-identity">
                <span className="avatar xl">{client.initials}</span>
                <div>
                  <div className="name-row">
                    <h1>{client.name}</h1>
                    <span className="badge soft">{client.badge}</span>
                  </div>
                  <p className="phone">{client.phone}</p>
                  {client.createdByName && (
                    <p className="created-by">
                      Created by {client.createdByName} · {client.createdByCode}
                    </p>
                  )}
                </div>
              </div>

              <div className="client-stats">
                <div className="stat">
                  <span className="stat-label">Current Cycle</span>
                  <strong>
                    {client.cycleCurrent} / {client.cycleTotal}
                  </strong>
                  <em>
                    {client.cycleCurrent} session{client.cycleCurrent === 1 ? '' : 's'} completed in
                    current cycle
                  </em>
                </div>
                <div className="stat">
                  <span className="stat-label">Session History</span>
                  <strong>{client.totalSessions} Total Sessions</strong>
                  <em>
                    {client.completed} completed · {client.upcoming} upcoming
                  </em>
                </div>
              </div>

              <div className="client-actions">
                <button type="button" className="btn primary" onClick={openAddSession}>
                  + Add Session
                </button>
                {clientBookings.length > 0 && (
                  <button type="button" className="btn outline" onClick={openBooked}>
                    View Booked Sessions
                  </button>
                )}
                <button type="button" className="btn outline" onClick={openNote}>
                  Send Note to Admin
                </button>
              </div>
            </div>
          </section>
        )}

        {panel === 'session' && (
          <section className="card panel-card">
            <div className="panel-head">
              <h2>{editingId ? 'Edit Session' : 'Add Session'}</h2>
              <button type="button" className="text-btn" onClick={() => { setPanel(null); setEditingId(null) }}>
                Close
              </button>
            </div>
            <form className="session-form" onSubmit={saveSession}>
              <label>
                Date & time
                <input
                  type="datetime-local"
                  value={form.dateTime}
                  onChange={(e) => updateForm('dateTime', e.target.value)}
                  required
                />
              </label>
              <label>
                Session type
                <select
                  value={form.sessionType}
                  onChange={(e) => updateForm('sessionType', e.target.value)}
                >
                  {sessionTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cycle
                <input type="text" value={form.cycle} readOnly title="Auto-filled to next cycle" />
                <span className="field-hint">Pre-filled to the next tracking number</span>
              </label>
              <fieldset className="seg">
                <legend>Sex</legend>
                {['M', 'F', 'Other'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={form.sex === s ? 'active' : ''}
                    onClick={() => updateForm('sex', s)}
                  >
                    {s}
                  </button>
                ))}
              </fieldset>
              <label>
                Amount (Rs)
                <input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(e) => updateForm('amount', e.target.value)}
                  required
                />
              </label>
              <fieldset className="seg">
                <legend>Settled</legend>
                <button
                  type="button"
                  className={form.settled ? 'active' : ''}
                  onClick={() => updateForm('settled', true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={!form.settled ? 'active' : ''}
                  onClick={() => updateForm('settled', false)}
                >
                  No
                </button>
              </fieldset>
              <label>
                Bonus
                <input
                  type="number"
                  min="0"
                  value={form.bonus}
                  onChange={(e) => updateForm('bonus', e.target.value)}
                />
              </label>
              <label>
                Lunez
                <input
                  type="number"
                  min="0"
                  value={form.lunez}
                  onChange={(e) => updateForm('lunez', e.target.value)}
                />
              </label>
              <div className="therapist-field">
                <span>Assigned therapists</span>
                <div className="chip-row">
                  {therapists.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`chip ${form.therapists.includes(t) ? 'on' : ''}`}
                      onClick={() => toggleTherapist(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                Hands
                <select value={form.hands} onChange={(e) => updateForm('hands', e.target.value)}>
                  {handsOptions.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Comments (optional)
                <textarea
                  rows={3}
                  value={form.comments}
                  onChange={(e) => updateForm('comments', e.target.value)}
                  placeholder="Any notes for this session…"
                />
              </label>
              <label className="staff-code-field full">
                Staff unique code
                <input
                  type="password"
                  autoComplete="off"
                  value={form.staffCode}
                  onChange={(e) => updateForm('staffCode', e.target.value)}
                  placeholder="e.g. FD-1001"
                  required
                />
                <span className="field-hint">
                  {editingId
                    ? editingSession && isFromUnusedBooking(editingSession)
                      ? 'Any valid staff code can edit sessions pulled from unused bookings'
                      : `Must match the creator code (${editingSession?.staffCode || '—'})`
                    : 'Required — who saved this session (admin audit)'}
                </span>
              </label>
              <div className="form-actions full">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setPanel(null)
                    setEditingId(null)
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  {editingId ? 'Update Session' : 'Save Session'}
                </button>
              </div>
            </form>
          </section>
        )}

        {panel === 'booked' && client && (
          <section className="card panel-card">
            <div className="panel-head">
              <h2>Booked Sessions</h2>
              <button type="button" className="text-btn" onClick={() => setPanel(null)}>
                Close
              </button>
            </div>
            {clientBookings.length === 0 ? (
              <p className="muted">No unused booked sessions for this client.</p>
            ) : (
              <>
                <label className="staff-code-field booked-staff">
                  Staff unique code
                  <input
                    type="password"
                    autoComplete="off"
                    value={bookedStaffCode}
                    onChange={(e) => setBookedStaffCode(e.target.value)}
                    placeholder="e.g. FD-1001"
                  />
                  <span className="field-hint">Required before Add to Session</span>
                </label>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Session Type</th>
                        <th>Cycle</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientBookings.map((b, i) => (
                        <tr key={b.id}>
                          <td>{i + 1}</td>
                          <td>{b.date}</td>
                          <td>{b.sessionType}</td>
                          <td>{b.cycle}</td>
                          <td>{formatMoney(b.amount)}</td>
                          <td>
                            <span className="badge booked">{b.status}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn small primary"
                              onClick={() => addBookedToSessions(b)}
                            >
                              Add to Session
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {panel === 'note' && client && (
          <section className="card panel-card note-panel">
            <div className="panel-head">
              <h2>Notes to Admin / Raise Ticket</h2>
              <button type="button" className="text-btn" onClick={() => setPanel(null)}>
                Close
              </button>
            </div>
            <form onSubmit={sendNote}>
              <textarea
                rows={5}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={`e.g. Update ${client.name}'s phone number, change cycle, or raise a ticket…`}
              />
              <div className="note-foot">
                <span className="muted">{note.length}/500</span>
                <button type="submit" className="btn primary">
                  Send to Admin
                </button>
              </div>
            </form>
            {noteSent && <p className="success">Ticket sent. Admin will follow up.</p>}
            <ul className="note-examples">
              <li>Update client phone / contact details</li>
              <li>Request cycle adjustment</li>
              <li>Flag a billing or therapist issue</li>
            </ul>
          </section>
        )}

        <section className="card saved-card">
          <div className="saved-head">
            <h2>Saved Sessions</h2>
            <div className="date-filters">
              <button
                type="button"
                className={dateFilter === 'today' ? 'active' : ''}
                onClick={() => setDateFilter('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={dateFilter === 'yesterday' ? 'active' : ''}
                onClick={() => setDateFilter('yesterday')}
              >
                Yesterday
              </button>
              <button
                type="button"
                className={dateFilter === 'pick' ? 'active' : ''}
                onClick={() => setDateFilter('pick')}
              >
                Pick Date
              </button>
              {dateFilter === 'pick' ? (
                <input
                  type="date"
                  value={pickedDate}
                  onChange={(e) => setPickedDate(e.target.value)}
                />
              ) : (
                <span className="date-label">{formatLongDate(filterDate)}</span>
              )}
            </div>
          </div>

          {filteredSaved.length === 0 ? (
            <p className="muted empty-saved">No saved sessions for this day.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date & Time</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Cycle</th>
                    <th>Amount</th>
                    <th>Settled</th>
                    <th>Bonus</th>
                    <th>Lunez</th>
                    <th>Therapist(s)</th>
                    <th>Hands</th>
                    <th>Staff</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSaved.map((s, i) => {
                    const editable = canEdit(s)
                    return (
                      <tr key={s.id}>
                        <td>{i + 1}</td>
                        <td>{formatDateTime(s.dateTime)}</td>
                        <td>{s.clientName}</td>
                        <td>{s.sessionType}</td>
                        <td>{s.cycle}</td>
                        <td>{formatMoney(s.amount)}</td>
                        <td>{s.settled ? 'Yes' : 'No'}</td>
                        <td>{s.bonus || 0}</td>
                        <td>{s.lunez || 0}</td>
                        <td>{s.therapists.join(', ')}</td>
                        <td>{s.hands}</td>
                        <td>
                          {s.staffName ? (
                            <span title={s.staffCode}>
                              {s.staffName}
                              <em className="staff-code-tag"> {s.staffCode}</em>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className={`badge ${s.status === 'Completed' ? 'done' : 'pending'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="actions-cell">
                          {editable && (
                            <button
                              type="button"
                              className="btn small ghost"
                              title={
                                isFromUnusedBooking(s)
                                  ? 'Any staff can edit (from unused booking)'
                                  : `Only ${s.staffName || 'creator'} (${s.staffCode}) can edit`
                              }
                              onClick={() => startEdit(s)}
                            >
                              Edit
                            </button>
                          )}
                          {s.status !== 'Completed' && (
                            <button
                              type="button"
                              className="btn small outline"
                              onClick={() => completeClient(s)}
                            >
                              Complete Client
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="edit-note">
            Edit unavailable after 36 hrs. Only the creating staff code can edit a session — except
            sessions added from unused bookings.
          </p>
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
