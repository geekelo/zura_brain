import { useEffect, useMemo, useRef, useState } from 'react'
import ClientPhoneQr from './ClientPhoneQr'
import PhoneQrScanner from './PhoneQrScanner'
import {
  clients,
  bookedByClient,
  sessionTypes,
  massageTypes,
  DEFAULT_MASSAGE_TYPE,
  DEFAULT_AMOUNT,
  amountOptions,
  DEFAULT_LUNEZ_AMOUNT,
  DEFAULT_LUNEZ_AMOUNT_YES,
  lunezAmountOptions,
  handsOptions,
  staffDirectory,
  paymentStatusLabel,
  whatsappTemplates,
  clientSupportDescriptions,
  DEFAULT_CLIENT_SUPPORT_AMOUNT,
  clientSupportTypes,
  DEFAULT_CLIENT_SUPPORT_TYPE,
} from './data'
import {
  createPosClient,
  searchPosClients,
  createPosSession,
  listPosSessions,
  setPosSessionTimes,
  createPosAdminNote,
  updatePosClientPreferences,
  normalizeClient,
  clientKey,
  normalizeSession,
  formatSessionTherapistsLabel,
  paymentReceiptImgUrl,
  sessionHistoryTrueLabels,
  hasSessionTime,
  nowTimeOfDay,
  toTimeOfDay,
  formatDuration,
} from './api'
import SessionActions from './SessionActions'
import SessionTherapists from './SessionTherapists'
import AddPaymentModal from './AddPaymentModal'
import ConfirmPaymentsModal from './ConfirmPaymentsModal'
import IconButton, {
  IconUsers,
  IconPaymentPlus,
  IconConfirmPayment,
} from './IconButton'
import './App.css'

const SESSIONS_AUTO_REFRESH_MS = 3 * 60 * 1000

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
  return `₦${Number(n).toLocaleString()}`
}

function PaymentMethodsDisplay({ paymentMethods, onOpenReceipt }) {
  if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
    return <span className="muted">—</span>
  }
  return (
    <ul className="payment-methods-list">
      {paymentMethods.map((pm, pi) => {
        const receipt = paymentReceiptImgUrl(pm)
        return (
          <li key={pm.id || `${pm.source}-${pm.type}-${pi}`} className="payment-method-item">
            <div className="payment-method-main">
              <strong className="payment-method-amount">{formatMoney(pm.amount)}</strong>
              <span className="payment-method-meta">
                {[pm.source, pm.type].filter(Boolean).join(' · ') || '—'}
              </span>
              {pm.status ? (
                <span className="badge soft">{paymentStatusLabel(pm.status)}</span>
              ) : null}
            </div>
            {receipt ? (
              <button
                type="button"
                className="receipt-thumb-btn"
                onClick={() => onOpenReceipt(receipt)}
                aria-label="View receipt"
              >
                <img src={receipt} alt="" className="receipt-thumb" />
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Always show cycle progress over 4, never API cycle_length as denominator. */
function formatSessionCycle(s) {
  const n = s?.cycleNum
  if (n == null || n === '') return 'Cycle — · —/4'
  return `Cycle ${n} · ${n}/4`
}

function isEvenCycle(value) {
  const n = Number(value)
  return Number.isFinite(n) && n % 2 === 0
}

function parseCycleLength(value, cycle) {
  if (String(value).toLowerCase() === 'bonus') {
    if (!isEvenCycle(cycle)) return null
    return 'bonus'
  }
  const n = Number(value)
  if (![1, 2, 3, 4].includes(n)) return null
  return n
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '')
}

/** WhatsApp honorific from client sex. */
function clientHonorific(client) {
  const sex = String(client?.sex || '').toLowerCase()
  if (sex === 'f' || sex === 'female') return 'Madam'
  return 'Sir'
}

/**
 * Digits for wa.me (international, no +).
 * Local NG numbers like 080… → 23480…
 */
function whatsappPhoneDigits(phone) {
  let d = digitsOnly(phone)
  if (!d) return ''
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length >= 10) d = `234${d.slice(1)}`
  return d
}

function fillWhatsappTemplate(body, client) {
  return String(body || '').replaceAll('{honorific}', clientHonorific(client))
}

function openWhatsappToClient(client, templateBody) {
  const phone = whatsappPhoneDigits(client?.phone)
  if (!phone) return { ok: false, error: 'Client phone required' }
  const text = fillWhatsappTemplate(templateBody, client)
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
  window.open(href, '_blank', 'noopener,noreferrer')
  return { ok: true }
}

function resolveStaff(code) {
  const normalized = String(code || '').trim().toUpperCase()
  if (!normalized) return null
  return staffDirectory.find((s) => s.code.toUpperCase() === normalized) || null
}

function emptyForm() {
  return {
    sessionType: sessionTypes[0],
    massageType: DEFAULT_MASSAGE_TYPE,
    amount: String(DEFAULT_AMOUNT),
    offCycle: false,
    lunez: false,
    lunezAmount: String(DEFAULT_LUNEZ_AMOUNT),
    hands: '2',
    staffCode: '',
    clientSupport: false,
    clientSupportDescription: clientSupportDescriptions[0],
    clientSupportNotes: '',
    clientSupportAmount: String(DEFAULT_CLIENT_SUPPORT_AMOUNT),
    clientSupportType: DEFAULT_CLIENT_SUPPORT_TYPE,
  }
}

function emptyClientForm() {
  return {
    name: '',
    phone: '',
    other_phones: '',
    sex: 'M',
    cycle: '0',
    cycle_length: '4',
    adult: true,
    staffCode: '',
    phoneCode: generatePhoneCode(),
  }
}

/** year + hour + minute, e.g. 20261215 */
function generatePhoneCode(date = new Date()) {
  const year = date.getFullYear()
  const hour = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${year}${hour}${min}`
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
  const [scanQrOpen, setScanQrOpen] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState([])
  const [client, setClient] = useState(null)
  const [booked, setBooked] = useState({})
  const [saved, setSaved] = useState([])
  const [panel, setPanel] = useState(null) // 'session' | 'booked' | 'note' | 'preferences' | 'whatsapp' | 'create' | null
  const [form, setForm] = useState(emptyForm)
  const [clientForm, setClientForm] = useState(emptyClientForm)
  const [note, setNote] = useState('')
  const [noteStaffCode, setNoteStaffCode] = useState('')
  const [noteSent, setNoteSent] = useState(false)
  const [sendingNote, setSendingNote] = useState(false)
  const [preferencesText, setPreferencesText] = useState('')
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [dateFilter, setDateFilter] = useState('today') // today | yesterday | pick
  const [pickedDate, setPickedDate] = useState(() => todayISO().toISOString().slice(0, 10))
  /** day = date filter; client = all sessions for selected client (by cycle) */
  const [listMode, setListMode] = useState('day') // day | client
  const [bookedStaffCode, setBookedStaffCode] = useState('')
  const [toast, setToast] = useState('')
  const [savingClient, setSavingClient] = useState(false)
  const [searching, setSearching] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [activeSession, setActiveSession] = useState(null)
  const [assignSession, setAssignSession] = useState(null)
  const [addPaymentSession, setAddPaymentSession] = useState(null)
  const [confirmPaymentsSession, setConfirmPaymentsSession] = useState(null)
  const [receiptLightbox, setReceiptLightbox] = useState('')
  const [autoRefreshSessions, setAutoRefreshSessions] = useState(false)

  const clientBookings = client
    ? booked[clientKey(client)] || bookedByClient[clientKey(client)] || []
    : []
  const canSearch = query.trim().length >= 3

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  const sessionsAutoRefreshTimerRef = useRef(null)
  const refreshSessionsRef = useRef(null)
  const autoRefreshSessionsRef = useRef(false)

  function sessionsRefreshOpts() {
    if (listMode === 'client' && client?.phone) return { phone: client.phone }
    return {}
  }

  function clearSessionsAutoRefresh() {
    if (sessionsAutoRefreshTimerRef.current) {
      clearTimeout(sessionsAutoRefreshTimerRef.current)
      sessionsAutoRefreshTimerRef.current = null
    }
  }

  function scheduleSessionsAutoRefresh() {
    clearSessionsAutoRefresh()
    if (!autoRefreshSessionsRef.current) return
    sessionsAutoRefreshTimerRef.current = setTimeout(() => {
      if (!autoRefreshSessionsRef.current) return
      refreshSessionsRef.current?.()
    }, SESSIONS_AUTO_REFRESH_MS)
  }

  function toggleAutoRefreshSessions() {
    const next = !autoRefreshSessionsRef.current
    autoRefreshSessionsRef.current = next
    setAutoRefreshSessions(next)
    if (next) scheduleSessionsAutoRefresh()
    else clearSessionsAutoRefresh()
  }

  async function refreshSessions(opts = sessionsRefreshOpts()) {
    setLoadingSessions(true)
    try {
      const result = await listPosSessions(opts)
      if (!result.ok) {
        showToast(result.error)
        if (opts.phone) setSaved([])
        return
      }
      setSaved((prev) => {
        const byCode = new Map(
          prev.filter((s) => s.sessionCode).map((s) => [s.sessionCode, s]),
        )
        return result.sessions.map((s) => {
          const existing = s.sessionCode ? byCode.get(s.sessionCode) : null
          if (!existing) return s
          return {
            ...s,
            // Sessions now always include payment_methods (possibly []).
            paymentMethods: Array.isArray(s.paymentMethods)
              ? s.paymentMethods
              : existing.paymentMethods || [],
            staffCode: s.staffCode || existing.staffCode || '',
            staffName: s.staffName || existing.staffName || '',
            sessionCreatorName: s.sessionCreatorName || existing.sessionCreatorName || '',
            therapists:
              Array.isArray(s.therapists) && s.therapists.length > 0
                ? s.therapists
                : existing.therapists || [],
            therapistLabel:
              formatSessionTherapistsLabel(s.sessionTherapists) ||
              (Array.isArray(s.therapists) && s.therapists.length > 0
                ? s.therapists.join(', ')
                : '') ||
              existing.therapistLabel ||
              '',
            sessionTherapists:
              Array.isArray(s.sessionTherapists) && s.sessionTherapists.length > 0
                ? s.sessionTherapists
                : existing.sessionTherapists || [],
            clientName: s.clientName || existing.clientName || '',
            clientPhone: s.clientPhone || existing.clientPhone || '',
          }
        })
      })
      setActiveSession((cur) => {
        if (!cur?.sessionCode) return cur
        const next = result.sessions.find((s) => s.sessionCode === cur.sessionCode)
        if (!next) return cur
        return {
          ...next,
          paymentMethods: Array.isArray(next.paymentMethods)
            ? next.paymentMethods
            : cur.paymentMethods || [],
          staffCode: next.staffCode || cur.staffCode || '',
          sessionCreatorName: next.sessionCreatorName || cur.sessionCreatorName || '',
          sessionTherapists:
            Array.isArray(next.sessionTherapists) && next.sessionTherapists.length > 0
              ? next.sessionTherapists
              : cur.sessionTherapists || [],
          therapists:
            Array.isArray(next.therapists) && next.therapists.length > 0
              ? next.therapists
              : cur.therapists || [],
          therapistLabel:
            formatSessionTherapistsLabel(next.sessionTherapists) ||
            (Array.isArray(next.therapists) && next.therapists.length > 0
              ? next.therapists.join(', ')
              : '') ||
            cur.therapistLabel ||
            '',
          clientName: next.clientName || cur.clientName || '',
          clientPhone: next.clientPhone || cur.clientPhone || '',
        }
      })
      setAssignSession((cur) => {
        if (!cur?.sessionCode) return cur
        const next = result.sessions.find((s) => s.sessionCode === cur.sessionCode)
        return next || cur
      })
    } catch (err) {
      showToast(err?.message || 'Could not load sessions')
    } finally {
      setLoadingSessions(false)
      // When auto refresh is on, next run is 3 minutes after this refresh finishes.
      scheduleSessionsAutoRefresh()
    }
  }

  refreshSessionsRef.current = refreshSessions

  useEffect(() => {
    refreshSessions()
    return () => {
      clearSessionsAutoRefresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function requireStaff(code) {
    const staff = resolveStaff(code)
    if (!staff) {
      showToast('Enter a valid staff unique code')
      return null
    }
    return staff
  }

  async function runSearch(e, overrideQuery, { selectSingle = false } = {}) {
    e?.preventDefault()
    const q = String(overrideQuery ?? query).trim()
    if (q.length < 3) {
      showToast('Type at least 3 characters to search')
      return
    }
    if (searching) return

    setQuery(q)
    setSearched(true)
    setClient(null)
    setListMode('day')
    setPanel(null)
    setActiveSession(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setNoteSent(false)
    setSearching(true)

    try {
      const result = await searchPosClients(q)
      if (!result.ok) {
        setResults([])
        showToast(result.error)
        return
      }
      setResults(result.clients)
      setClientList((list) => {
        const byPhone = new Map(list.map((c) => [clientKey(c), c]))
        result.clients.forEach((c) => byPhone.set(clientKey(c), c))
        return Array.from(byPhone.values())
      })
      if (selectSingle && result.clients.length === 1) {
        selectClient(result.clients[0])
      }
    } catch (err) {
      setResults([])
      showToast(err?.message || 'Network error — could not search')
    } finally {
      setSearching(false)
    }
  }

  function handleQrPhoneScanned(phone) {
    setScanQrOpen(false)
    const q = String(phone || '').trim()
    setQuery(q)
    showToast(`Scanned ${q}`)
    runSearch(null, q, { selectSingle: true })
  }

  function openCreateClient() {
    setClient(null)
    setListMode('day')
    setResults([])
    setActiveSession(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setClientForm(emptyClientForm())
    setPanel('create')
  }

  async function saveClientForm(e) {
    e?.preventDefault()
    if (savingClient) return

    const name = clientForm.name.trim()
    const code = clientForm.staffCode.trim()
    const otherPhones = clientForm.other_phones.trim()

    if (!code) {
      showToast('Enter a staff unique code')
      return
    }
    if (clientForm.cycle === '' || clientForm.cycle == null) {
      showToast('Cycle is required')
      return
    }
    if (!clientForm.cycle_length) {
      showToast('Cycle length is required')
      return
    }
    if (!clientForm.sex) {
      showToast('Sex is required')
      return
    }

    const phone = clientForm.phone.trim() || clientForm.phoneCode
    if (!phone) {
      showToast('Phone is required')
      return
    }
    const phoneDigits = digitsOnly(phone)
    if (phoneDigits.length < 7) {
      showToast('Enter a valid phone number or use the generated code')
      return
    }

    const cycle = Math.max(0, Number(clientForm.cycle) || 0)
    const cycleLength = parseCycleLength(clientForm.cycle_length, cycle)
    if (!cycleLength) {
      showToast(
        clientForm.cycle_length === 'bonus' && !isEvenCycle(cycle)
          ? 'Bonus is only available when cycle is an even number'
          : 'Select a valid cycle length',
      )
      return
    }

    setSavingClient(true)
    try {
      const result = await createPosClient({
        code,
        client: {
          name,
          phone,
          other_phones: otherPhones,
          sex: clientForm.sex,
          cycle,
          cycle_length: cycleLength,
          adult: !!clientForm.adult,
        },
      })

      if (!result.ok) {
        showToast(result.error)
        return
      }

      const savedClient = normalizeClient(result.client)
      const key = clientKey(savedClient)
      setClientList((list) => {
        const without = list.filter((c) => clientKey(c) !== key)
        return [savedClient, ...without]
      })
      setBooked((prev) => ({ ...prev, [key]: prev[key] || [] }))
      setPanel(null)
      setClientForm(emptyClientForm())
      selectClient(savedClient)
      showToast(`Client created by ${savedClient.created_by || code}`)
    } catch (err) {
      showToast(err?.message || 'Network error — could not reach API')
    } finally {
      setSavingClient(false)
    }
  }

  function selectClient(c) {
    setClient(c)
    setResults([])
    setPanel(null)
    setForm(emptyForm())
    setActiveSession(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setNote('')
    setNoteSent(false)
    const key = clientKey(c)
    if (key && !booked[key]) {
      setBooked((prev) => ({ ...prev, [key]: [...(bookedByClient[key] || [])] }))
    }
    setListMode('day')
  }

  async function openClientSessions() {
    if (!client?.phone) {
      showToast('Client phone required')
      return
    }
    setPanel(null)
    setActiveSession(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setListMode('client')
    await refreshSessions({ phone: client.phone })
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  function openAddSession() {
    if (!client) return
    setActiveSession(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setForm(emptyForm())
    setPanel('session')
  }

  function openBooked() {
    setBookedStaffCode('')
    setPanel('booked')
  }

  function openNote() {
    setNoteSent(false)
    setNote('')
    setNoteStaffCode('')
    setPanel('note')
  }

  function openPreferences() {
    setPreferencesText(client?.preferences || '')
    setPanel('preferences')
  }

  function openWhatsapp() {
    setPanel('whatsapp')
  }

  function sendWhatsappTemplate(template) {
    const result = openWhatsappToClient(client, template.body)
    if (!result.ok) {
      showToast(result.error)
      return
    }
    showToast('Opening WhatsApp…')
  }

  async function savePreferences(e) {
    e?.preventDefault()
    if (savingPreferences || !client?.phone) return
    setSavingPreferences(true)
    try {
      const result = await updatePosClientPreferences({
        phone: client.phone,
        client_preferences: preferencesText,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      const saved = normalizeClient(result.client)
      const key = clientKey(saved)
      setClient(saved)
      setClientList((list) => {
        const without = list.filter((c) => clientKey(c) !== key)
        return [saved, ...without]
      })
      setPreferencesText(saved.preferences || '')
      showToast('Preferences saved')
    } catch (err) {
      showToast(err?.message || 'Could not save preferences')
    } finally {
      setSavingPreferences(false)
    }
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function saveSession(e) {
    e?.preventDefault()
    if (savingSession) return
    if (!client) return

    const st = String(form.staffCode || '').trim()
    if (!st) {
      showToast('Enter a staff unique code')
      return
    }
    if (form.amount === '' || Number(form.amount) < 0) {
      showToast('Enter a valid amount')
      return
    }
    if (!form.hands) {
      showToast('Select hands')
      return
    }
    if (!form.sessionType) {
      showToast('Select session type')
      return
    }
    if (!form.massageType) {
      showToast('Select massage type')
      return
    }

    setSavingSession(true)
    try {
      const sessionPayload = {
        session_type: form.sessionType,
        massage_type: form.massageType,
        amount: form.amount,
        off_cycle: !!form.offCycle,
        lunez: !!form.lunez,
        hands: form.hands,
      }
      if (form.lunez) {
        const amt = Number(form.lunezAmount)
        sessionPayload.lunez_amount =
          Number.isFinite(amt) && amt > 0 ? amt : DEFAULT_LUNEZ_AMOUNT_YES
      }
      let client_support
      if (form.clientSupport) {
        const desc = String(form.clientSupportDescription || '').trim()
        const supportAmt = Number(form.clientSupportAmount)
        if (!desc) {
          showToast('Client support description is required')
          return
        }
        if (!(supportAmt > 0)) {
          showToast('Client support amount must be greater than 0')
          return
        }
        const type = String(form.clientSupportType || '').trim().toLowerCase()
        if (type !== 'payin' && type !== 'payout') {
          showToast('Client support type is required')
          return
        }
        client_support = {
          description: desc,
          amount: supportAmt,
          type,
        }
        const notes = String(form.clientSupportNotes || '').trim()
        if (notes) client_support.notes = notes
      }
      const result = await createPosSession({
        st,
        client_phone: client.phone,
        session: sessionPayload,
        client_support,
      })

      if (!result.ok) {
        showToast(result.error)
        return
      }

      const row = normalizeSession(result.session, {
        clientName: client.name,
        clientPhone: client.phone,
        staffCode: st,
        staffName: resolveStaff(st)?.name || st,
      })
      setSaved((list) => [
        row,
        ...list.filter((s) => s.sessionCode !== row.sessionCode),
      ])
      setClient((c) => {
        if (!c) return c
        const api = result.session
        const nextCycle = api.cycle ?? c.cycle
        const nextLength = api.cycle_length ?? c.cycle_length
        return {
          ...c,
          cycle: nextCycle,
          cycle_length: nextLength,
          cycleCurrent: nextCycle,
          cycleTotal: nextLength,
          totalSessions: (c.totalSessions || 0) + 1,
          pendingSessions: (c.pendingSessions || 0) + 1,
        }
      })
      setForm(emptyForm())
      setPanel(null)
      setDateFilter('today')
      showToast('Session saved')
      refreshSessions()
    } catch (err) {
      showToast(err?.message || 'Network error — could not save session')
    } finally {
      setSavingSession(false)
    }
  }

  function addBookedToSessions(booking) {
    if (!client) return
    const staff = requireStaff(bookedStaffCode)
    if (!staff) return
    const now = new Date()
    const key = clientKey(client)
    const row = {
      id: `s-${Date.now()}`,
      clientPhone: client.phone,
      clientName: client.name,
      dateTime: now.toISOString(),
      sessionType: booking.sessionType,
      cycle: booking.cycle,
      amount: booking.amount,
      settled: false,
      lunez: !!booking.lunez,
      lunezAmount: 0,
      hands: booking.hands,
      comments: [],
      status: 'pending',
      source: 'booked',
      sessionCode: '',
      staffCode: staff.code,
      staffName: staff.name,
    }

    setSaved((list) => [row, ...list])
    setBooked((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((b) => b.id !== booking.id),
    }))
    setBookedStaffCode('')
    setDateFilter('today')
    showToast(`Booked session added by ${staff.name}`)
  }

  function upsertSavedSession(next) {
    const code = next.sessionCode
    setSaved((list) => {
      const without = code
        ? list.filter((s) => s.sessionCode !== code)
        : list
      return [next, ...without]
    })
    setActiveSession((cur) =>
      cur && code && cur.sessionCode === code ? next : cur,
    )
    setAssignSession((cur) =>
      cur && code && cur.sessionCode === code ? next : cur,
    )
    setAddPaymentSession((cur) =>
      cur && code && cur.sessionCode === code ? next : cur,
    )
    setConfirmPaymentsSession((cur) =>
      cur && code && cur.sessionCode === code ? next : cur,
    )
  }

  function applyPaymentMethods(sessionCode, nextList) {
    const patch = (cur) =>
      cur && cur.sessionCode === sessionCode
        ? { ...cur, paymentMethods: nextList }
        : cur
    setSaved((list) =>
      list.map((s) => (s.sessionCode === sessionCode ? { ...s, paymentMethods: nextList } : s)),
    )
    setActiveSession(patch)
    setAssignSession(patch)
    setAddPaymentSession(patch)
    setConfirmPaymentsSession(patch)
  }

  function removeSavedSession(sessionCode) {
    setSaved((list) => list.filter((s) => s.sessionCode !== sessionCode))
    refreshSessions()
  }

  function sessionTimeControls(s) {
    const confirmed = String(s.status || '').toLowerCase() === 'confirmed'
    const started = hasSessionTime(s.startTime)
    const ended = hasSessionTime(s.endTime)
    return {
      showStart: !confirmed && !started,
      showEnd: !confirmed && started && !ended,
    }
  }

  async function startSavedSession(s) {
    if (!s.sessionCode) {
      showToast('Session code required')
      return
    }
    try {
      const result = await setPosSessionTimes({
        sessionCode: s.sessionCode,
        start_time: nowTimeOfDay(),
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      const row = normalizeSession(result.session, {
        clientName: s.clientName,
        clientPhone: s.clientPhone,
        staffCode: s.staffCode,
        paymentMethods: s.paymentMethods,
        sessionTherapists: s.sessionTherapists,
      })
      upsertSavedSession(row)
      showToast('Session started')
      refreshSessions()
    } catch (err) {
      showToast(err?.message || 'Could not start session')
    }
  }

  async function endSavedSession(s) {
    if (!s.sessionCode) {
      showToast('Session code required')
      return
    }
    const start = toTimeOfDay(s.startTime)
    if (!start) {
      showToast('Start time is required before ending')
      return
    }
    try {
      const result = await setPosSessionTimes({
        sessionCode: s.sessionCode,
        start_time: start,
        end_time: nowTimeOfDay(),
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      const row = normalizeSession(result.session, {
        clientName: s.clientName,
        clientPhone: s.clientPhone,
        staffCode: s.staffCode,
        paymentMethods: s.paymentMethods,
        sessionTherapists: s.sessionTherapists,
      })
      upsertSavedSession(row)
      showToast('Session ended')
      refreshSessions()
    } catch (err) {
      showToast(err?.message || 'Could not end session')
    }
  }

  function openAssignSession(s) {
    setPanel(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setAssignSession(s)
  }

  function openAddPayment(s) {
    setPanel(null)
    setAssignSession(null)
    setConfirmPaymentsSession(null)
    setAddPaymentSession(s)
  }

  function openConfirmPayments(s) {
    setPanel(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(s)
  }

  function openManageSession(s) {
    setPanel(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setActiveSession(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function sendNote(e) {
    e?.preventDefault()
    if (sendingNote) return
    if (!client?.phone) {
      showToast('Client phone required')
      return
    }
    if (!noteStaffCode.trim()) {
      showToast('Enter your therapist code')
      return
    }
    if (!note.trim()) {
      showToast('Write a note first')
      return
    }
    setSendingNote(true)
    try {
      const result = await createPosAdminNote({
        st: noteStaffCode.trim(),
        phone: client.phone,
        admin_note: { body: note.trim(), status: 'open' },
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      setNoteSent(true)
      setNote('')
      showToast('Admin note created')
    } catch (err) {
      showToast(err?.message || 'Could not create admin note')
    } finally {
      setSendingNote(false)
    }
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
    if (listMode === 'client' && client?.phone) {
      const phone = String(client.phone).replace(/\D/g, '')
      return [...saved]
        .filter((s) => {
          const sp = String(s.clientPhone || '').replace(/\D/g, '')
          return sp && phone && (sp === phone || sp.endsWith(phone) || phone.endsWith(sp))
        })
        .sort((a, b) => {
          const ca = Number(a.cycleNum) || 0
          const cb = Number(b.cycleNum) || 0
          if (ca !== cb) return ca - cb
          return new Date(a.dateTime) - new Date(b.dateTime)
        })
    }
    return saved
      .filter((s) => startOfDay(s.dateTime).getTime() === filterDate.getTime())
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
  }, [saved, filterDate, listMode, client])

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
        <div className="header-actions">
          <div className="user">
            <span className="avatar">FD</span>
            <span>Front Desk</span>
          </div>
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
              placeholder="Search by name, phone, or scan QR"
              aria-label="Search client by name or phone"
            />
            <button
              type="button"
              className="btn outline"
              onClick={() => setScanQrOpen(true)}
              title="Scan client QR code"
            >
              Scan QR
            </button>
            <button type="submit" className="btn primary" disabled={!canSearch || searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
            <button type="button" className="btn outline" onClick={openCreateClient}>
              + Create Client
            </button>
          </div>
          <div className="info-banner">
            <span className="info-i">i</span>
            Search by name or phone, or scan a Zura Spa client QR — the phone fills the search field.
          </div>
        </form>

        <PhoneQrScanner
          open={scanQrOpen}
          onClose={() => setScanQrOpen(false)}
          onScan={handleQrPhoneScanned}
          showToast={showToast}
        />

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
          <section className="card panel-card create-panel">
            <div className="panel-head">
              <h2>
                <span className="panel-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c1.5-3.5 4.2-5 8-5s6.5 1.5 8 5" />
                  </svg>
                </span>
                Create Client
              </h2>
              <button type="button" className="text-btn close-btn" onClick={() => setPanel(null)}>
                Close ✕
              </button>
            </div>
            <form className="create-form" onSubmit={saveClientForm}>
              <div className="create-row two">
                <label>
                  Name
                  <input
                    value={clientForm.name}
                    onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Optional"
                  />
                </label>
                <label className="staff-code-field">
                  <span className="label-text">
                    Staff unique code <em>*</em>
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={clientForm.staffCode}
                    onChange={(e) => setClientForm((f) => ({ ...f, staffCode: e.target.value }))}
                    placeholder="e.g. ADA1"
                    required
                  />
                </label>
              </div>

              <div className="create-row two">
                <label>
                  <span className="label-text">
                    Phone <em>*</em>
                  </span>
                  <span className="phone-code-hint">
                    No number? Use code{' '}
                    <button
                      type="button"
                      className="phone-code-btn"
                      title="Copy code"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(clientForm.phoneCode)
                          showToast('Code copied')
                        } catch {
                          setClientForm((f) => ({ ...f, phone: f.phoneCode }))
                          showToast('Code filled into phone')
                        }
                      }}
                    >
                      {clientForm.phoneCode}
                    </button>
                    <button
                      type="button"
                      className="text-btn use-code-btn"
                      onClick={() => setClientForm((f) => ({ ...f, phone: f.phoneCode }))}
                    >
                      Use
                    </button>
                  </span>
                  <input
                    value={clientForm.phone}
                    onChange={(e) => setClientForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone number or paste generated code"
                  />
                  <span className="field-hint">Leave blank to save with the generated code above</span>
                </label>
                <label>
                  Other phones
                  <textarea
                    rows={4}
                    value={clientForm.other_phones}
                    onChange={(e) => setClientForm((f) => ({ ...f, other_phones: e.target.value }))}
                    placeholder="Optional — extra numbers, one per line or comma-separated"
                  />
                </label>
              </div>

              <div className="create-row three split">
                <fieldset className="seg">
                  <legend>
                    <span className="label-text">
                      Sex <em>*</em>
                    </span>
                  </legend>
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
                <fieldset className="seg">
                  <legend>
                    <span className="label-text">
                      Adult <em>*</em>
                    </span>
                  </legend>
                  <button
                    type="button"
                    className={clientForm.adult ? 'active' : ''}
                    onClick={() => setClientForm((f) => ({ ...f, adult: true }))}
                  >
                    Yes
                  </button>
        <button
          type="button"
                    className={!clientForm.adult ? 'active' : ''}
                    onClick={() => setClientForm((f) => ({ ...f, adult: false }))}
                  >
                    No
                  </button>
                </fieldset>
                <label>
                  <span className="label-text">
                    Cycle <em>*</em>
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={clientForm.cycle}
                    onChange={(e) => {
                      const cycle = e.target.value
                      setClientForm((f) => {
                        const next = { ...f, cycle }
                        if (f.cycle_length === 'bonus' && !isEvenCycle(cycle)) {
                          next.cycle_length = '4'
                        }
                        return next
                      })
                    }}
                    required
                  />
                  <span className="field-hint">Current cycle position</span>
                </label>
              </div>

              <div className="create-row two">
                <label>
                  <span className="label-text">
                    Cycle length <em>*</em>
                  </span>
                  <select
                    value={clientForm.cycle_length}
                    onChange={(e) => setClientForm((f) => ({ ...f, cycle_length: e.target.value }))}
                    required
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="bonus" disabled={!isEvenCycle(clientForm.cycle)}>
                      bonus
                    </option>
                  </select>
                  {!isEvenCycle(clientForm.cycle) && (
                    <span className="field-hint">Bonus only when cycle is even (0, 2, 4…)</span>
                  )}
                </label>
                <div className="create-spacer" aria-hidden="true" />
              </div>

              <div className="form-actions">
                <button type="button" className="btn ghost" onClick={() => setPanel(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={savingClient}>
                  {savingClient ? 'Saving…' : 'Save Client'}
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
                <li key={clientKey(c) || c.phone || c.name}>
                  <button type="button" className="result-row" onClick={() => selectClient(c)}>
                    <span className="avatar lg">{c.initials}</span>
                    <span className="result-meta">
                      <strong>{c.name || c.phone || 'Unnamed client'}</strong>
                      {c.name ? <em>{c.phone}</em> : null}
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
            <div className="client-panel">
              <div className="client-panel-main">
                <div className="client-identity">
                  <span className="avatar xl">{client.initials}</span>
                  <div className="client-identity-body">
                    <div className="name-row">
                      <h1>{client.name || client.phone || 'Unnamed client'}</h1>
                      <span className="badge soft">
                        {client.adult === false ? 'Minor' : client.badge || 'Adult'}
                      </span>
                      {client.sex && <span className="badge soft">{client.sex}</span>}
                    </div>
                    <p className="phone">{client.phone}</p>
                    {client.other_phones && (
                      <p className="phone other-phones">Other: {client.other_phones}</p>
                    )}
                    {(client.created_by || client.createdByName || client.created_at) && (
                      <p className="client-meta-line">
                        {[
                          (client.createdByName || client.created_by) &&
                            `Created by ${client.createdByName || client.created_by}`,
                          client.created_at &&
                            new Date(client.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                {client.preferences ? (
                  <p className="client-preferences">{client.preferences}</p>
                ) : (
                  <p className="client-preferences muted">No preferences set</p>
                )}

                <div className="client-metrics">
                  <div className="metric">
                    <span className="metric-label">Cycle</span>
                    <strong>{client.cycle ?? client.cycleCurrent ?? 0}</strong>
                    <p>
                      Cycle length {(client.cycle ?? client.cycleCurrent ?? 0)}/4
                    </p>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Sessions</span>
                    <strong>{client.totalSessions ?? 0}</strong>
                  </div>
                  <div className="metric metric-wide">
                    <span className="metric-label">By status</span>
                    <p>
                      {client.completedSessions ?? 0} completed ·{' '}
                      {client.ongoingSessions ?? 0} ongoing ·{' '}
                      {client.pendingSessions ?? 0} pending ·{' '}
                      {client.disputedSessions ?? 0} disputed
                    </p>
                  </div>
                </div>

                <div className="client-actions">
                  <button type="button" className="btn primary" onClick={openAddSession}>
                    + Add Session
                  </button>
                  <button type="button" className="btn outline" onClick={openClientSessions}>
                    View sessions
                  </button>
                  {clientBookings.length > 0 && (
                    <button type="button" className="btn outline" onClick={openBooked}>
                      Booked
                    </button>
                  )}
                  <button type="button" className="btn outline" onClick={openWhatsapp}>
                    Message
                  </button>
                  <button type="button" className="btn outline" onClick={openPreferences}>
                    Preferences
                  </button>
                  <button type="button" className="btn ghost client-action-quiet" onClick={openNote}>
                    Request edit
                  </button>
                </div>
              </div>

              <aside className="client-panel-qr" aria-label="Client QR code">
                <ClientPhoneQr
                  phone={client.phone}
                  clientName={client.name}
                  whatsappPhoneDigits={whatsappPhoneDigits}
                  showToast={showToast}
                />
              </aside>
            </div>
          </section>
        )}

        {panel === 'whatsapp' && client && (
          <section className="card panel-card whatsapp-panel">
            <div className="panel-head">
              <h2>WhatsApp</h2>
              <button type="button" className="text-btn" onClick={() => setPanel(null)}>
                Close
              </button>
            </div>
            <p className="muted note-intro">
              Send a message to {client.name || client.phone} · {client.phone}. Opens WhatsApp with
              the message ready to send ({clientHonorific(client)}).
            </p>
            <ul className="whatsapp-template-list">
              {whatsappTemplates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="whatsapp-template-btn"
                    onClick={() => sendWhatsappTemplate(t)}
                  >
                    <strong>{t.label}</strong>
                    <span>{t.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {panel === 'preferences' && client && (
          <section className="card panel-card note-panel">
            <div className="panel-head">
              <h2>Client preferences</h2>
              <button type="button" className="text-btn" onClick={() => setPanel(null)}>
                Close
              </button>
            </div>
            <p className="muted note-intro">
              Update preferences for {client.name || client.phone}. No admin code required.
            </p>
            <form className="session-form" onSubmit={savePreferences}>
              <label className="full">
                Preferences
                <textarea
                  rows={4}
                  maxLength={500}
                  value={preferencesText}
                  onChange={(e) => setPreferencesText(e.target.value)}
                  placeholder="e.g. Light pressure, quiet room"
                />
              </label>
              <div className="note-foot full">
                <span className="muted">{preferencesText.length}/500</span>
                <button type="submit" className="btn primary" disabled={savingPreferences}>
                  {savingPreferences ? 'Saving…' : 'Save preferences'}
                </button>
              </div>
            </form>
          </section>
        )}

        {panel === 'session' && (
          <section className="card panel-card">
            <div className="panel-head">
              <h2>Add Session</h2>
              <button type="button" className="text-btn" onClick={() => setPanel(null)}>
                Close
              </button>
        </div>
            {client && (
              <p className="muted note-intro">
                Saving for <strong>{client.name}</strong> · {client.phone}. Date and cycle are set by
                the server.
              </p>
            )}
            <form className="session-form" onSubmit={saveSession}>
              <label>
                Session type
                <select
                  value={form.sessionType}
                  onChange={(e) => updateForm('sessionType', e.target.value)}
                  required
                >
                  {sessionTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Massage type
                <select
                  value={form.massageType}
                  onChange={(e) => updateForm('massageType', e.target.value)}
                  required
                >
                  {massageTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Amount
                <select
                  value={form.amount}
                  onChange={(e) => updateForm('amount', e.target.value)}
                  required
                >
                  {amountOptions.map((a) => (
                    <option key={a} value={String(a)}>
                      {a.toLocaleString()}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="seg">
                <legend>Off cycle</legend>
                <button
                  type="button"
                  className={form.offCycle ? 'active' : ''}
                  onClick={() => updateForm('offCycle', true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={!form.offCycle ? 'active' : ''}
                  onClick={() => updateForm('offCycle', false)}
                >
                  No
                </button>
              </fieldset>
              <fieldset className="seg">
                <legend>Lunez</legend>
                <button
                  type="button"
                  className={form.lunez ? 'active' : ''}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      lunez: true,
                      lunezAmount: String(DEFAULT_LUNEZ_AMOUNT_YES),
                    }))
                  }
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={!form.lunez ? 'active' : ''}
                  onClick={() =>
                    setForm((f) => ({ ...f, lunez: false, lunezAmount: String(DEFAULT_LUNEZ_AMOUNT) }))
                  }
                >
                  No
                </button>
              </fieldset>
              {form.lunez && (
                <label>
                  Lunez amount
                  <select
                    value={form.lunezAmount}
                    onChange={(e) => updateForm('lunezAmount', e.target.value)}
                    required
                  >
                    {lunezAmountOptions.map((a) => (
                      <option key={a} value={String(a)}>
                        {a.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Hands
                <select
                  value={form.hands}
                  onChange={(e) => updateForm('hands', e.target.value)}
                  required
                >
                  {handsOptions.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="seg full">
                <legend>Client support</legend>
                <button
                  type="button"
                  className={form.clientSupport ? 'active' : ''}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      clientSupport: true,
                      clientSupportDescription:
                        f.clientSupportDescription || clientSupportDescriptions[0],
                      clientSupportAmount:
                        f.clientSupportAmount || String(DEFAULT_CLIENT_SUPPORT_AMOUNT),
                    }))
                  }
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={!form.clientSupport ? 'active' : ''}
                  onClick={() => setForm((f) => ({ ...f, clientSupport: false }))}
                >
                  No
                </button>
              </fieldset>
              {form.clientSupport && (
                <>
                  <label>
                    <span className="label-text">
                      Support description <em>*</em>
                    </span>
                    <select
                      value={form.clientSupportDescription}
                      onChange={(e) => updateForm('clientSupportDescription', e.target.value)}
                      required
                    >
                      {clientSupportDescriptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label-text">
                      Support amount <em>*</em>
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={form.clientSupportAmount}
                      onChange={(e) => updateForm('clientSupportAmount', e.target.value)}
                      placeholder="e.g. 2000"
                      required
                    />
                  </label>
                  <label>
                    <span className="label-text">
                      Support type <em>*</em>
                    </span>
                    <select
                      value={form.clientSupportType}
                      onChange={(e) => updateForm('clientSupportType', e.target.value)}
                      required
                    >
                      {clientSupportTypes.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="full">
                    Support notes
                    <input
                      value={form.clientSupportNotes}
                      onChange={(e) => updateForm('clientSupportNotes', e.target.value)}
                      placeholder="Optional — e.g. Paid from the front desk"
                    />
                  </label>
                </>
              )}
              <label className="staff-code-field full">
                <span className="label-text">
                  Staff unique code <em>*</em>
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  value={form.staffCode}
                  onChange={(e) => updateForm('staffCode', e.target.value)}
                  placeholder="e.g. ADA1"
                  required
                />
                <span className="field-hint">Therapist code that creates this session</span>
              </label>
              <div className="form-actions full">
                <button type="button" className="btn ghost" onClick={() => setPanel(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={savingSession}>
                  {savingSession ? 'Saving…' : 'Save Session'}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeSession && (
          <SessionActions
            key={activeSession.sessionCode || 'session'}
            session={activeSession}
            clientName={activeSession.clientName || client?.name}
            showToast={showToast}
            onClose={() => setActiveSession(null)}
            onUpdated={upsertSavedSession}
            onDeleted={removeSavedSession}
            onRefreshSessions={refreshSessions}
            onOpenAddPayment={() => openAddPayment(activeSession)}
            onOpenConfirmPayments={() => openConfirmPayments(activeSession)}
            onOpenAssign={() => openAssignSession(activeSession)}
          />
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
              <h2>Request client edit / Raise ticket</h2>
              <button type="button" className="text-btn" onClick={() => setPanel(null)}>
                Close
              </button>
            </div>
            <p className="muted note-intro">
              Front desk cannot edit client details. Send an admin note for{' '}
              {client.name || client.phone}.
            </p>
            <form className="session-form" onSubmit={sendNote}>
              <label className="staff-code-field full">
                <span className="label-text">
                  Your therapist code <em>*</em>
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  value={noteStaffCode}
                  onChange={(e) => setNoteStaffCode(e.target.value)}
                  placeholder="code"
                  required
                />
              </label>
              <label className="full">
                Note
                <textarea
                  rows={5}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={`e.g. Please update ${client.name || 'client'}'s phone from ${client.phone} to …`}
                  required
                />
              </label>
              <div className="note-foot full">
                <span className="muted">{note.length}/500</span>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={sendingNote || !note.trim() || !noteStaffCode.trim()}
                >
                  {sendingNote ? 'Sending…' : 'Send to Admin'}
                </button>
              </div>
            </form>
            {noteSent && <p className="success">Admin note created for this client.</p>}
            <ul className="note-examples">
              <li>Update name, phone, or other phones</li>
              <li>Change cycle / cycle length / adult status</li>
              <li>Correct sex or other profile details</li>
            </ul>
          </section>
        )}

        <section className="card saved-card">
          <div className="saved-head">
            <h2>
              {listMode === 'client' && client
                ? `Sessions · ${client.name || client.phone}`
                : 'Saved Sessions'}
              {loadingSessions ? ' …' : ''}
            </h2>
            <div className="date-filters">
              {listMode === 'client' ? (
                <>
                  <span className="date-label">Ordered by cycle</span>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => {
                      setListMode('day')
                      refreshSessions()
                    }}
                  >
                    Back to day view
                  </button>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => refreshSessions({ phone: client.phone })}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className={`btn small ${autoRefreshSessions ? 'primary' : 'ghost'}`}
                    aria-pressed={autoRefreshSessions}
                    onClick={toggleAutoRefreshSessions}
                  >
                    Auto refresh {autoRefreshSessions ? 'on' : 'off'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={dateFilter === 'today' ? 'active' : ''}
                    onClick={() => {
                      setListMode('day')
                      setDateFilter('today')
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={dateFilter === 'yesterday' ? 'active' : ''}
                    onClick={() => {
                      setListMode('day')
                      setDateFilter('yesterday')
                    }}
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    className={dateFilter === 'pick' ? 'active' : ''}
                    onClick={() => {
                      setListMode('day')
                      setDateFilter('pick')
                    }}
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
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => refreshSessions()}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className={`btn small ${autoRefreshSessions ? 'primary' : 'ghost'}`}
                    aria-pressed={autoRefreshSessions}
                    onClick={toggleAutoRefreshSessions}
                  >
                    Auto refresh {autoRefreshSessions ? 'on' : 'off'}
                  </button>
                </>
              )}
            </div>
          </div>

          {filteredSaved.length === 0 ? (
            <p className="muted empty-saved">
              {loadingSessions
                ? 'Loading sessions…'
                : listMode === 'client'
                  ? 'No sessions for this client.'
                  : 'No saved sessions for this day.'}
            </p>
          ) : (
            <>
              <div className="session-table-desktop">
                <table className="session-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>When</th>
                      <th>Client</th>
                      <th>Details</th>
                      <th>Therapists</th>
                      <th>Amount</th>
                      <th>Payments</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSaved.map((s, i) => (
                      <tr
                        key={s.sessionCode || `row-${i}`}
                        className={
                          activeSession?.sessionCode &&
                          activeSession.sessionCode === s.sessionCode
                            ? 'row-active'
                            : ''
                        }
                      >
                        <td>{i + 1}</td>
                        <td>
                          <div className="cell-stack">
                            <strong>{formatDateTime(s.dateTime)}</strong>
                            {sessionHistoryTrueLabels(s.sessionHistory).length > 0 && (
                              <span className="session-history-flags">
                                {sessionHistoryTrueLabels(s.sessionHistory).map((label) => (
                                  <span key={label} className="history-flag">
                                    {label}
                                  </span>
                                ))}
                              </span>
                            )}
                            {Array.isArray(s.comments) && s.comments.length > 0 && (
                              <span className="comments-flag">
                                {s.comments.length}{' '}
                                {s.comments.length === 1 ? 'comment' : 'comments'}
                                {s.comments.some((c) => !c.resolved)
                                  ? ` · ${s.comments.filter((c) => !c.resolved).length} open`
                                  : ' · all resolved'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>{s.clientName || '—'}</strong>
                            {s.clientPhone && <span className="muted">{s.clientPhone}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack session-details-cell">
                            <strong>
                              {[s.sessionType, s.massageType].filter(Boolean).join(' · ') ||
                                '—'}
                            </strong>
                            <span className="muted">{formatSessionCycle(s)}</span>
                            {s.offCycle ? <span className="muted">Off cycle</span> : null}
                            {s.hands ? (
                              <span className="muted">{s.hands} hands</span>
                            ) : null}
                            <span className="muted">
                              Start {s.startTime || '—'}
                            </span>
                            <span className="muted">
                              End {s.endTime || '—'}
                            </span>
                            <span className="muted session-duration">
                              Duration {formatDuration(s.duration)}
                            </span>
                            {s.sessionCreatorName ? (
                              <span className="muted">Created by {s.sessionCreatorName}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <span>
                              {s.therapistLabel ||
                                formatSessionTherapistsLabel(s.sessionTherapists) ||
                                '—'}
                            </span>
                            <IconButton
                              label="Assign therapists"
                              variant="primary"
                              disabled={!s.sessionCode}
                              onClick={() => openAssignSession(s)}
                            >
                              <IconUsers />
                            </IconButton>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>{formatMoney(s.amount)}</strong>
                            {s.lunez ? (
                              <span className="muted">
                                Lunez {formatMoney(s.lunezAmount || 0)}
                              </span>
                            ) : null}
                            {s.clientSupport ? (
                              <span className="muted">
                                Support {s.clientSupport.description}{' '}
                                {formatMoney(s.clientSupport.amount)}
                                {s.clientSupport.type ? ` · ${s.clientSupport.type}` : ''}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <PaymentMethodsDisplay
                            paymentMethods={s.paymentMethods}
                            onOpenReceipt={setReceiptLightbox}
                          />
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              s.status === 'settled' ||
                              s.status === 'completed' ||
                              s.status === 'ended'
                                ? 'done'
                                : 'pending'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <div className="session-row-actions">
                            {sessionTimeControls(s).showStart && (
                              <button
                                type="button"
                                className="btn small primary"
                                disabled={!s.sessionCode}
                                onClick={() => startSavedSession(s)}
                              >
                                Start
                              </button>
                            )}
                            {sessionTimeControls(s).showEnd && (
                              <button
                                type="button"
                                className="btn small primary"
                                disabled={!s.sessionCode}
                                onClick={() => endSavedSession(s)}
                              >
                                End
                              </button>
                            )}
                            <IconButton
                              label="Confirm payments"
                              variant="primary"
                              disabled={!s.sessionCode}
                              onClick={() => openConfirmPayments(s)}
                            >
                              <IconConfirmPayment />
                            </IconButton>
                            <IconButton
                              label="Add payment"
                              variant="primary"
                              disabled={!s.sessionCode}
                              onClick={() => openAddPayment(s)}
                            >
                              <IconPaymentPlus />
                            </IconButton>
                            <button
                              type="button"
                              className="btn small ghost"
                              disabled={!s.sessionCode}
                              title="Manage session"
                              onClick={() => openManageSession(s)}
                            >
                              Manage
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="session-cards">
                {filteredSaved.map((s, i) => {
                  const timeBtns = sessionTimeControls(s)
                  return (
                  <li
                    key={s.sessionCode || `card-${i}`}
                    className={`session-card ${
                      activeSession?.sessionCode &&
                      activeSession.sessionCode === s.sessionCode
                        ? 'row-active'
                        : ''
                    }`}
                  >
                    <div className="session-card-top">
                      <span className="session-card-index">#{i + 1}</span>
                      <span
                        className={`badge ${
                          s.status === 'settled' ||
                          s.status === 'completed' ||
                          s.status === 'ended'
                            ? 'done'
                            : 'pending'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <strong className="session-card-title">
                      {s.clientName || s.clientPhone || 'Unnamed client'}
                    </strong>
                    {s.clientName && s.clientPhone && (
                      <p className="session-card-meta">{s.clientPhone}</p>
                    )}
                    <p className="session-card-meta">{formatDateTime(s.dateTime)}</p>
                    {sessionHistoryTrueLabels(s.sessionHistory).length > 0 && (
                      <p className="session-history-flags">
                        {sessionHistoryTrueLabels(s.sessionHistory).map((label) => (
                          <span key={label} className="history-flag">
                            {label}
                          </span>
                        ))}
                      </p>
                    )}
                    {Array.isArray(s.comments) && s.comments.length > 0 && (
                      <p className="session-card-meta">
                        <span className="comments-flag">
                          {s.comments.length}{' '}
                          {s.comments.length === 1 ? 'comment' : 'comments'}
                          {s.comments.some((c) => !c.resolved)
                            ? ` · ${s.comments.filter((c) => !c.resolved).length} open`
                            : ' · all resolved'}
                        </span>
                      </p>
                    )}
                    <p className="session-card-meta">
                      {[s.sessionType, s.massageType].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <p className="session-card-meta">{formatSessionCycle(s)}</p>
                    {s.offCycle ? <p className="session-card-meta">Off cycle</p> : null}
                    {s.hands ? (
                      <p className="session-card-meta">{s.hands} hands</p>
                    ) : null}
                    <p className="session-card-meta">Start {s.startTime || '—'}</p>
                    <p className="session-card-meta">End {s.endTime || '—'}</p>
                    <p className="session-card-meta session-duration">
                      Duration {formatDuration(s.duration)}
                    </p>
                    <p className="session-card-meta">
                      Therapists:{' '}
                      {s.therapistLabel ||
                        formatSessionTherapistsLabel(s.sessionTherapists) ||
                        '—'}
                    </p>
                    {s.sessionCreatorName && (
                      <p className="session-card-meta">Created by {s.sessionCreatorName}</p>
                    )}
                    <p className="session-card-meta">
                      <strong>{formatMoney(s.amount)}</strong>
                    </p>
                    {s.lunez ? (
                      <p className="session-card-meta">
                        Lunez {formatMoney(s.lunezAmount || 0)}
                      </p>
                    ) : null}
                    {s.clientSupport ? (
                      <p className="session-card-meta">
                        Support {s.clientSupport.description}{' '}
                        {formatMoney(s.clientSupport.amount)}
                        {s.clientSupport.type ? ` · ${s.clientSupport.type}` : ''}
                      </p>
                    ) : null}
                    <div className="session-card-payments">
                      <span className="session-card-meta">Payments</span>
                      <PaymentMethodsDisplay
                        paymentMethods={s.paymentMethods}
                        onOpenReceipt={setReceiptLightbox}
                      />
                    </div>
                    <div className="session-row-actions session-card-action">
                      {timeBtns.showStart && (
                        <button
                          type="button"
                          className="btn small primary"
                          disabled={!s.sessionCode}
                          onClick={() => startSavedSession(s)}
                        >
                          Start
                        </button>
                      )}
                      {timeBtns.showEnd && (
                        <button
                          type="button"
                          className="btn small primary"
                          disabled={!s.sessionCode}
                          onClick={() => endSavedSession(s)}
                        >
                          End
                        </button>
                      )}
                      <IconButton
                        label="Assign therapists"
                        variant="primary"
                        disabled={!s.sessionCode}
                        onClick={() => openAssignSession(s)}
                      >
                        <IconUsers />
                      </IconButton>
                      <IconButton
                        label="Confirm payments"
                        variant="primary"
                        disabled={!s.sessionCode}
                        onClick={() => openConfirmPayments(s)}
                      >
                        <IconConfirmPayment />
                      </IconButton>
                      <IconButton
                        label="Add payment"
                        variant="primary"
                        disabled={!s.sessionCode}
                        onClick={() => openAddPayment(s)}
                      >
                        <IconPaymentPlus />
                      </IconButton>
                      <button
                        type="button"
                        className="btn small ghost"
                        disabled={!s.sessionCode}
                        title="Manage session"
                        onClick={() => openManageSession(s)}
                      >
                        Manage
                      </button>
                    </div>
            </li>
                  )
                })}
          </ul>
            </>
          )}
      </section>
      </main>

      {assignSession && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setAssignSession(null)}
        >
          <div
            className="modal-card modal-card-wide modal-card-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-therapists-title"
            onClick={(e) => e.stopPropagation()}
          >
            <SessionTherapists
              key={`assign-${assignSession.sessionCode || 'session'}`}
              session={assignSession}
              showToast={showToast}
              onClose={() => setAssignSession(null)}
              onUpdated={upsertSavedSession}
              onRefreshSessions={refreshSessions}
              embedded
            />
          </div>
        </div>
      )}

      {addPaymentSession && (
        <AddPaymentModal
          session={addPaymentSession}
          showToast={showToast}
          onClose={() => setAddPaymentSession(null)}
          onAdded={(row) => {
            const nextList = [
              row,
              ...(Array.isArray(addPaymentSession.paymentMethods)
                ? addPaymentSession.paymentMethods.filter((p) => p.id !== row.id)
                : []),
            ]
            applyPaymentMethods(addPaymentSession.sessionCode, nextList)
            refreshSessions()
          }}
        />
      )}

      {confirmPaymentsSession && (
        <ConfirmPaymentsModal
          session={confirmPaymentsSession}
          showToast={showToast}
          onClose={() => setConfirmPaymentsSession(null)}
          onSessionUpdated={(row) => {
            upsertSavedSession(row)
            refreshSessions()
          }}
          onPaymentUpdated={(nextList) => {
            applyPaymentMethods(confirmPaymentsSession.sessionCode, nextList)
            refreshSessions()
          }}
        />
      )}

      {receiptLightbox && (
        <div
          className="modal-backdrop receipt-lightbox"
          role="presentation"
          onClick={() => setReceiptLightbox('')}
        >
          <button
            type="button"
            className="receipt-lightbox-close text-btn"
            onClick={() => setReceiptLightbox('')}
          >
            Close
          </button>
          <img
            src={receiptLightbox}
            alt="Payment receipt"
            className="receipt-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
