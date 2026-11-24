import { useEffect, useMemo, useRef, useState } from 'react'
import ClientPhoneQr from './ClientPhoneQr'
import SessionStatusBadge from './SessionStatusBadge'
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
  paymentStatusBadgeClass,
  whatsappTemplates,
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
import ClientSupportModal from './ClientSupportModal'
import AddCommentModal from './AddCommentModal'
import DisputeModal from './DisputeModal'
import IconButton, {
  IconUsers,
  IconPaymentPlus,
  IconConfirmPayment,
  IconClientSupport,
  IconComment,
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

function formatSessionDay(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function shortClock(value) {
  if (value == null || value === '') return ''
  const text = String(value)
  if (!text.includes('T') && !text.includes('-')) {
    const match = text.match(/(\d{1,2}):(\d{2})/)
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`
  }
  const d = new Date(text)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  const match = text.match(/(\d{1,2}):(\d{2})/)
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : ''
}

function sessionClockRange(session) {
  const start = shortClock(session.startTime) || shortClock(session.dateTime) || '—'
  const end = shortClock(session.endTime) || '—'
  return `${start} – ${end}`
}

function sessionTherapistRows(session) {
  if (Array.isArray(session?.sessionTherapists) && session.sessionTherapists.length) {
    return session.sessionTherapists
      .map((row) => ({
        name: String(row?.name || '').trim(),
        role: String(row?.role || '').trim(),
        tipped: Number(row?.tipAmount) > 0,
      }))
      .filter((row) => row.name)
  }
  const label = String(session?.therapistLabel || '').trim()
  if (!label) return []
  return label
    .split(',')
    .map((part) => {
      const match = part.trim().match(/^(.*?)(?:\s*\(([^)]+)\))?$/)
      return {
        name: String(match?.[1] || part).trim(),
        role: String(match?.[2] || '').trim(),
      }
    })
    .filter((row) => row.name)
}

function TherapistRoster({ session }) {
  const rows = sessionTherapistRows(session)
  if (!rows.length) return <span className="muted">—</span>
  return (
    <ul className="session-therapists">
      {rows.map((row, index) => (
        <li key={`${row.name}-${row.role}-${index}`} className={row.tipped ? 'has-tip' : ''}>
          <span className="therapist-name">{row.name}</span>
          {row.role ? (
            <span className={`therapist-role ${row.role.toLowerCase()}`}>{row.role}</span>
          ) : null}
          {row.tipped ? (
            <span className="therapist-tip" title="Tipped" aria-label="Tipped">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function DeskGlyph({ children }) {
  return (
    <svg className="desk-glyph" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

function formatMoney(n) {
  return `₦${Number(n).toLocaleString()}`
}

function formatPaymentWhen(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${day}, ${time}`
}

function CardIcon({ children }) {
  return (
    <svg className="session-card-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

function disputeCount(session) {
  return Array.isArray(session?.disputes) ? session.disputes.length : 0
}

function IconHourglass({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 3h11M6.5 21h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 4.2c.3 3.1 2.2 4.8 4.5 6.6-2.3 1.8-4.2 3.5-4.5 6.6M16.5 4.2c-.3 3.1-2.2 4.8-4.5 6.6 2.3 1.8 4.2 3.5 4.5 6.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SessionMobileCard({
  session: s,
  index,
  active,
  selectedClient,
  showStart,
  showEnd,
  onStart,
  onEnd,
  onAssign,
  onConfirm,
  onAddPayment,
  onSupport,
  onComment,
  onDispute,
  onManage,
  onOpenReceipt,
}) {
  const cycle = sessionCycleDisplay(s)
  const supports = Array.isArray(s.clientSupports) && s.clientSupports.length
    ? s.clientSupports
    : s.clientSupport
      ? [s.clientSupport]
      : []
  const comments = Array.isArray(s.comments) ? s.comments : []
  const openComments = comments.filter((c) => !c.resolved).length
  const history = sessionHistoryTrueLabels(s.sessionHistory)
  const service = [s.sessionType, s.massageType].filter(Boolean).join(' · ') || '—'
  const cycleBits = [cycle.line, s.hands ? `${s.hands} hands` : ''].filter(Boolean).join('  |  ')
  const clientCycle = clientCycleLine(s, selectedClient)

  return (
    <li className={`session-card${active ? ' row-active' : ''}`}>
      <div className="session-card-hero">
        <div className="session-card-brandbar">
          <span className="session-card-index">#{index + 1}</span>
        </div>
        <strong className="session-card-title">
          {s.clientName || s.clientPhone || 'Unnamed client'}
        </strong>
        {s.clientPhone ? (
          <p className="session-card-line">
            <CardIcon>
              <path d="M7 4.5h2.2l1.1 2.4-1.3 1a12 12 0 0 0 5.1 5.1l1-1.3 2.4 1.1V15a1.5 1.5 0 0 1-1.6 1.5A13.5 13.5 0 0 1 5.5 6.1 1.5 1.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </CardIcon>
            {s.clientPhone}
          </p>
        ) : null}
        {clientCycle ? <p className="session-card-line muted">{clientCycle}</p> : null}
        <p className="session-card-line">
          <CardIcon>
            <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </CardIcon>
          {formatDateTime(s.dateTime)}
        </p>
        <div className="session-card-chips">
          <SessionStatusBadge status={s.status} />
          {history.map((label) => (
            <span key={label} className="history-flag">{label}</span>
          ))}
          {comments.length > 0 ? (
            <span className="comments-flag">
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              {openComments ? ` · ${openComments} open` : ' · all resolved'}
            </span>
          ) : null}
        </div>
      </div>

      <div className="session-card-body">
        <section className="session-card-section">
          <span className="session-card-glyph" aria-hidden="true"><span className="lotus sm">❀</span></span>
          <div>
            <h3>Service Details</h3>
            <p>{service}</p>
            <p>
              {cycleBits}
              {cycle.offCycle ? ' · Off cycle' : ''}
            </p>
          </div>
        </section>

        <section className="session-card-section session-card-timing">
          <span className="session-card-glyph" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
              <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h3>Timing</h3>
            <div className="session-card-times">
              <p>
                <span>Start</span>
                {showStart ? (
                  <button
                    type="button"
                    className="session-card-time-btn"
                    disabled={!s.sessionCode}
                    onClick={() => onStart?.(s)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Start
                  </button>
                ) : (
                  <strong>{s.startTime || '—'}</strong>
                )}
              </p>
              <p>
                <span>End</span>
                {showEnd ? (
                  <button
                    type="button"
                    className="session-card-time-btn"
                    disabled={!s.sessionCode}
                    onClick={() => onEnd?.(s)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    End
                  </button>
                ) : (
                  <strong>{s.endTime || '—'}</strong>
                )}
              </p>
              <p><span>Duration</span><strong>{formatDuration(s.duration)}</strong></p>
            </div>
          </div>
        </section>

        <section className="session-card-section">
          <span className="session-card-glyph" aria-hidden="true"><IconUsers size={18} /></span>
          <div>
            <h3>Therapists</h3>
            <TherapistRoster session={s} />
          </div>
        </section>

        <section className="session-card-section">
          <span className="session-card-glyph" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
              <path d="M6 19a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h3>Created by</h3>
            <p>{s.sessionCreatorName || '—'}</p>
          </div>
        </section>

        <section className="session-card-section">
          <span className="session-card-glyph" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="7" rx="7" ry="3" stroke="currentColor" strokeWidth="1.7" />
              <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </span>
          <div>
            <h3>Pricing</h3>
            <p className="session-card-price">
              <strong>{formatMoney(s.amount)}</strong>
              {s.lunez ? <span>Lunez {formatMoney(s.lunezAmount || 0)}</span> : null}
            </p>
            {supports.map((cs, csi) => (
              <p key={cs.id || `${cs.description}-${csi}`}>
                Support {cs.description} {formatMoney(cs.amount)}
                {cs.type ? ` · ${cs.type}` : ''}
              </p>
            ))}
          </div>
        </section>

        <section className="session-card-section session-card-pay">
          <div className="session-card-pay-head">
            <span className="session-card-glyph" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </span>
            <h3>Payments</h3>
          </div>
          <PaymentMethodsDisplay
            paymentMethods={s.paymentMethods}
            onOpenReceipt={onOpenReceipt}
          />
        </section>
      </div>

      <div className="session-card-actions">
        <div className="session-action-grid">
          <button type="button" className="session-action-tile" aria-label="Assign Therapist" disabled={!s.sessionCode} onClick={() => onAssign(s)}>
            <IconUsers size={22} />
          </button>
          <button type="button" className="session-action-tile" aria-label="Verify payment" disabled={!s.sessionCode} onClick={() => onConfirm(s)}>
            <IconConfirmPayment size={22} />
          </button>
          <button type="button" className="session-action-tile" aria-label="Add payment" disabled={!s.sessionCode} onClick={() => onAddPayment?.(s)}>
            <IconPaymentPlus size={22} />
          </button>
          <button type="button" className="session-action-tile" aria-label="Client support" disabled={!s.sessionCode} onClick={() => onSupport(s)}>
            <IconClientSupport size={22} />
          </button>
          <button type="button" className="session-action-tile" aria-label="Add Comment" disabled={!s.sessionCode} onClick={() => onComment(s)}>
            <IconComment size={22} />
          </button>
        </div>
        {s.sessionHistory?.disputed ? (
          <button
            type="button"
            className="session-dispute-btn"
            disabled={!s.sessionCode}
            onClick={() => onDispute?.(s)}
          >
            <IconHourglass size={15} />
            Dispute
            <span className="dispute-count">{disputeCount(s)}</span>
          </button>
        ) : null}
        <button
          type="button"
          className="btn primary session-manage-btn"
          disabled={!s.sessionCode}
          onClick={() => onManage(s)}
        >
          <span aria-hidden="true">⚙</span>
          Manage
        </button>
      </div>
    </li>
  )
}

function PaymentMethodsDisplay({ paymentMethods, onOpenReceipt }) {
  if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
    return <span className="muted">—</span>
  }
  return (
    <ul className="payment-methods-list">
      {paymentMethods.map((pm, pi) => {
        const receipt = paymentReceiptImgUrl(pm)
        const when = formatPaymentWhen(pm.createdAt)
        return (
          <li
            key={pm.id || `${pm.source}-${pm.type}-${pi}`}
            className={`payment-method-item${receipt ? ' has-receipt' : ''}`}
          >
            <div className="payment-method-main">
              <strong className="payment-method-amount">{formatMoney(pm.amount)}</strong>
              <span className="payment-method-meta">
                {[pm.source, pm.type].filter(Boolean).join(' · ') || '—'}
              </span>
              {pm.status ? (
                <span className={`badge ${paymentStatusBadgeClass(pm.status)}`}>{paymentStatusLabel(pm.status)}</span>
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
            {when ? (
              <span className="payment-method-when">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {when}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function formatLengthOver4(length) {
  if (length == null || length === '') return ''
  const text = String(length).trim()
  if (!text) return ''
  if (text.includes('/') || text.toLowerCase() === 'bonus') return text
  return `${text}/4`
}

function formatCycleAndLength(cycle, length) {
  const cycleText = cycle == null || cycle === '' ? 'Cycle —' : `Cycle ${cycle}`
  const lengthText = formatLengthOver4(length)
  if (!lengthText) return cycleText
  return `${cycleText} · ${lengthText}`
}

function clientCycleLine(session, selectedClient) {
  const sameClient = digitsOnly(selectedClient?.phone) !== ''
    && digitsOnly(selectedClient?.phone) === digitsOnly(session?.clientPhone)
  const cycle = session?.clientCycle != null
    ? session.clientCycle
    : sameClient
      ? (selectedClient.cycle ?? selectedClient.cycleCurrent)
      : null
  const length = session?.clientCycleLength != null && session?.clientCycleLength !== ''
    ? session.clientCycleLength
    : sameClient
      ? (selectedClient.cycle_length ?? selectedClient.cycleTotal)
      : null
  if ((cycle == null || cycle === '') && (length == null || length === '')) return null
  return formatCycleAndLength(cycle, length)
}

function sessionCycleDisplay(session) {
  const cycleText = session?.cycleNum == null || session?.cycleNum === ''
    ? 'Cycle —'
    : `Cycle ${session.cycleNum}`
  const lengthEmpty = session?.cycleLength == null || session?.cycleLength === ''
  if (lengthEmpty && session?.offCycle) {
    return { line: cycleText, offCycle: true }
  }
  return {
    line: lengthEmpty ? cycleText : `${cycleText} · ${formatLengthOver4(session.cycleLength)}`,
    offCycle: !!session?.offCycle,
  }
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

/** year-month-date-hh-min-sec, e.g. 2026-11-23-15-58-04 */
function generatePhoneCode(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const sec = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}-${hour}-${min}-${sec}`
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
  const [dateFilter, setDateFilter] = useState('today') // today | yesterday | pick | disputed
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
  const [manageFocus, setManageFocus] = useState({ tab: 'update', status: '' })
  const [assignSession, setAssignSession] = useState(null)
  const [addPaymentSession, setAddPaymentSession] = useState(null)
  const [confirmPaymentsSession, setConfirmPaymentsSession] = useState(null)
  const [clientSupportSession, setClientSupportSession] = useState(null)
  const [addCommentSession, setAddCommentSession] = useState(null)
  const [disputeSession, setDisputeSession] = useState(null)
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

  useEffect(() => {
    if (!client?.phone) return undefined
    if (client.onCycleSessions != null && client.offCycleSessions != null) return undefined
    let cancelled = false
    listPosSessions({ phone: client.phone }).then((result) => {
      if (cancelled || !result.ok) return
      const sessions = result.sessions || []
      const offCycleSessions = sessions.filter((row) => row.offCycle).length
      setClient((current) => {
        if (!current || current.phone !== client.phone) return current
        if (current.onCycleSessions != null && current.offCycleSessions != null) return current
        return {
          ...current,
          offCycleSessions,
          onCycleSessions: sessions.length - offCycleSessions,
        }
      })
    })
    return () => {
      cancelled = true
    }
  }, [client?.phone, client?.onCycleSessions, client?.offCycleSessions])

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
    setClientSupportSession(null)
    setAddCommentSession(null)
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
    setClientSupportSession(null)
    setAddCommentSession(null)
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
    setClientSupportSession(null)
    setAddCommentSession(null)
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
    setClientSupportSession(null)
    setAddCommentSession(null)
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
    setClientSupportSession(null)
    setAddCommentSession(null)
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
      const result = await createPosSession({
        st,
        client_phone: client.phone,
        session: sessionPayload,
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
          onCycleSessions: c.onCycleSessions == null
            ? c.onCycleSessions
            : c.onCycleSessions + (row.offCycle ? 0 : 1),
          offCycleSessions: c.offCycleSessions == null
            ? c.offCycleSessions
            : c.offCycleSessions + (row.offCycle ? 1 : 0),
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
    setClientSupportSession((cur) =>
      cur && code && cur.sessionCode === code ? next : cur,
    )
    setAddCommentSession((cur) =>
      cur && code && cur.sessionCode === code ? next : cur,
    )
    setDisputeSession((cur) =>
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
    setClientSupportSession(patch)
    setAddCommentSession(patch)
    setDisputeSession(patch)
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
    setClientSupportSession(null)
    setAddCommentSession(null)
    setDisputeSession(null)
    setAssignSession(s)
  }

  function openAddPayment(s) {
    setPanel(null)
    setAssignSession(null)
    setConfirmPaymentsSession(null)
    setClientSupportSession(null)
    setAddCommentSession(null)
    setDisputeSession(null)
    setAddPaymentSession(s)
  }

  function openConfirmPayments(s) {
    setPanel(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setClientSupportSession(null)
    setAddCommentSession(null)
    setDisputeSession(null)
    setConfirmPaymentsSession(s)
  }

  function openClientSupport(s) {
    setPanel(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setAddCommentSession(null)
    setDisputeSession(null)
    setClientSupportSession(s)
  }

  function openAddComment(s) {
    setPanel(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setClientSupportSession(null)
    setDisputeSession(null)
    setAddCommentSession(s)
  }

  function openDispute(s) {
    setPanel(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setClientSupportSession(null)
    setAddCommentSession(null)
    setDisputeSession(s)
  }

  function openManageSession(s, focus = {}) {
    setPanel(null)
    setAssignSession(null)
    setAddPaymentSession(null)
    setConfirmPaymentsSession(null)
    setClientSupportSession(null)
    setAddCommentSession(null)
    setDisputeSession(null)
    setManageFocus({
      tab: focus.tab || 'update',
      status: focus.status || '',
    })
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
    if (dateFilter === 'disputed') {
      return saved
        .filter((s) => String(s.status || '').toLowerCase() === 'disputed')
        .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
    }
    return saved
      .filter((s) => startOfDay(s.dateTime).getTime() === filterDate.getTime())
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
  }, [saved, filterDate, dateFilter, listMode, client])

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
                    <p className="client-meta-line">
                      {formatCycleAndLength(
                        client.cycle ?? client.cycleCurrent,
                        client.cycle_length ?? client.cycleTotal,
                      )}
                    </p>
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
                      Length {formatLengthOver4(client.cycle_length ?? client.cycleTotal) || '—'}
                    </p>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Sessions</span>
                    <strong>{client.totalSessions ?? 0}</strong>
                  </div>
                  <div className="metric">
                    <span className="metric-label">On cycle</span>
                    <strong>{client.onCycleSessions ?? '…'}</strong>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Off cycle</span>
                    <strong>{client.offCycleSessions ?? '…'}</strong>
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
            key={`${activeSession.sessionCode || 'session'}-${manageFocus.tab}-${manageFocus.status}`}
            session={activeSession}
            clientName={activeSession.clientName || client?.name}
            showToast={showToast}
            initialTab={manageFocus.tab}
            initialStatus={manageFocus.status}
            onClose={() => setActiveSession(null)}
            onUpdated={upsertSavedSession}
            onDeleted={removeSavedSession}
            onRefreshSessions={refreshSessions}
            onOpenAddPayment={() => openAddPayment(activeSession)}
            onOpenConfirmPayments={() => openConfirmPayments(activeSession)}
            onOpenAssign={() => openAssignSession(activeSession)}
            onOpenClientSupport={() => openClientSupport(activeSession)}
            onOpenAddComment={() => openAddComment(activeSession)}
            onOpenDispute={() => openDispute(activeSession)}
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
                  <button
                    type="button"
                    className={dateFilter === 'disputed' ? 'active' : ''}
                    onClick={() => {
                      setListMode('day')
                      setDateFilter('disputed')
                    }}
                  >
                    Disputed
                  </button>
                  {dateFilter === 'disputed' ? (
                    <span className="date-label">Current status disputed</span>
                  ) : dateFilter === 'pick' ? (
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
                  : dateFilter === 'disputed'
                    ? 'No sessions with status disputed.'
                    : 'No saved sessions for this day.'}
            </p>
          ) : (
            <>
              <div className="session-table-desktop">
                <table className="session-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date & Time</th>
                      <th>Client</th>
                      <th>Service & Session Details</th>
                      <th>Therapists</th>
                      <th>Amount</th>
                      <th>Payments</th>
                      <th>Status</th>
                      <th>Actions</th>
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
                        <td>
                          <span className="session-index">{i + 1}</span>
                        </td>
                        <td>
                          <div className="cell-stack desk-stack">
                            <span className="desk-line strong">
                              <DeskGlyph>
                                <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
                                <path d="M4 9h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </DeskGlyph>
                              {formatSessionDay(s.dateTime)}
                            </span>
                            <span className="desk-line">
                              <DeskGlyph>
                                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                                <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </DeskGlyph>
                              {sessionClockRange(s)}
                            </span>
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
                          <div className="cell-stack desk-stack">
                            <span className="desk-line strong">
                              <DeskGlyph>
                                <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
                                <path d="M6 19a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </DeskGlyph>
                              {s.clientName || '—'}
                            </span>
                            {s.clientPhone ? (
                              <span className="desk-line">
                                <DeskGlyph>
                                  <path d="M7 4.5h2.2l1.1 2.4-1.3 1a12 12 0 0 0 5.1 5.1l1-1.3 2.4 1.1V15a1.5 1.5 0 0 1-1.6 1.5A13.5 13.5 0 0 1 5.5 6.1 1.5 1.5 0 0 1 7 4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                                </DeskGlyph>
                                {s.clientPhone}
                              </span>
                            ) : null}
                            {clientCycleLine(s, client) ? (
                              <span className="desk-line">{clientCycleLine(s, client)}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack desk-stack session-details-cell">
                            <span className="desk-line strong">
                              <DeskGlyph>
                                <path d="M12 4c2 2.4 3 4.2 3 6.2a3 3 0 1 1-6 0C9 8.2 10 6.4 12 4Z" stroke="currentColor" strokeWidth="1.7" />
                                <path d="M8 14.5c1.2 1.6 2.5 2.5 4 2.5s2.8-.9 4-2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                              </DeskGlyph>
                              {[s.sessionType, s.massageType].filter(Boolean).join(' · ') || '—'}
                            </span>
                            <span className="desk-line">
                              {sessionCycleDisplay(s).line}
                              {sessionCycleDisplay(s).offCycle ? ' · Off cycle' : ''}
                            </span>
                            {s.hands ? (
                              <span className="desk-line">
                                <DeskGlyph>
                                  <path d="M8 14V8.5a1.5 1.5 0 0 1 3 0V13M11 10.5V8a1.4 1.4 0 0 1 2.8 0V13M13.8 11V9.2a1.3 1.3 0 0 1 2.6 0V14c0 2.4-1.6 4-4.2 4-2 0-3.5-1.2-4.2-2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                </DeskGlyph>
                                {s.hands} hands
                              </span>
                            ) : null}
                            <span className="desk-line">
                              <DeskGlyph>
                                <path d="M8 4h8M12 4v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                <path d="M7 20h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </DeskGlyph>
                              Duration {formatDuration(s.duration)}
                            </span>
                            {s.sessionCreatorName ? (
                              <span className="desk-line">
                                <DeskGlyph>
                                  <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
                                  <path d="M6 19a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                </DeskGlyph>
                                Created by {s.sessionCreatorName}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <TherapistRoster session={s} />
                        </td>
                        <td>
                          <div className="cell-stack desk-stack">
                            <span className="desk-line strong">
                              <DeskGlyph>
                                <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                                <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" />
                              </DeskGlyph>
                              {formatMoney(s.amount)}
                            </span>
                            {s.lunez ? (
                              <span className="desk-line">Lunez {formatMoney(s.lunezAmount || 0)}</span>
                            ) : null}
                            {(Array.isArray(s.clientSupports) && s.clientSupports.length
                              ? s.clientSupports
                              : s.clientSupport
                                ? [s.clientSupport]
                                : []
                            ).map((cs, csi) => (
                              <span key={cs.id || `${cs.description}-${csi}`} className="desk-line">
                                Support {cs.description} {formatMoney(cs.amount)}
                                {cs.type ? ` · ${cs.type}` : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <PaymentMethodsDisplay
                            paymentMethods={s.paymentMethods}
                            onOpenReceipt={setReceiptLightbox}
                          />
                        </td>
                        <td>
                          <SessionStatusBadge status={s.status} />
                        </td>
                        <td className="actions-cell">
                          <div className="desk-actions">
                            <div className="desk-action-grid">
                              {sessionTimeControls(s).showStart && (
                                <button
                                  type="button"
                                  className="desk-text-btn desk-time-btn"
                                  disabled={!s.sessionCode}
                                  onClick={() => startSavedSession(s)}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                                    <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                  </svg>
                                  Start
                                </button>
                              )}
                              {sessionTimeControls(s).showEnd && (
                                <button
                                  type="button"
                                  className="desk-text-btn desk-time-btn"
                                  disabled={!s.sessionCode}
                                  onClick={() => endSavedSession(s)}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                                    <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                  </svg>
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
                              <IconButton
                                label="Client support"
                                variant="primary"
                                disabled={!s.sessionCode}
                                onClick={() => openClientSupport(s)}
                              >
                                <IconClientSupport />
                              </IconButton>
                              <IconButton
                                label="Add comment"
                                variant="primary"
                                disabled={!s.sessionCode}
                                onClick={() => openAddComment(s)}
                              >
                                <IconComment />
                              </IconButton>
                              {s.sessionHistory?.disputed ? (
                                <button
                                  type="button"
                                  className="desk-text-btn desk-dispute-btn"
                                  disabled={!s.sessionCode}
                                  onClick={() => openDispute(s)}
                                >
                                  <IconHourglass size={13} />
                                  Dispute
                                  <span className="dispute-count">{disputeCount(s)}</span>
                                </button>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="desk-manage"
                              disabled={!s.sessionCode}
                              onClick={() => openManageSession(s)}
                            >
                              <span aria-hidden="true">⚙</span>
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
                {filteredSaved.map((s, i) => (
                  <SessionMobileCard
                    key={s.sessionCode || `card-${i}`}
                    session={s}
                    index={i}
                    active={
                      !!(
                        activeSession?.sessionCode &&
                        activeSession.sessionCode === s.sessionCode
                      )
                    }
                    selectedClient={client}
                    showStart={sessionTimeControls(s).showStart}
                    showEnd={sessionTimeControls(s).showEnd}
                    onStart={startSavedSession}
                    onEnd={endSavedSession}
                    onAssign={openAssignSession}
                    onConfirm={openConfirmPayments}
                    onAddPayment={openAddPayment}
                    onSupport={openClientSupport}
                    onComment={openAddComment}
                    onDispute={openDispute}
                    onManage={openManageSession}
                    onOpenReceipt={setReceiptLightbox}
                  />
                ))}
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

      {clientSupportSession && (
        <ClientSupportModal
          session={clientSupportSession}
          showToast={showToast}
          onClose={() => setClientSupportSession(null)}
          onUpdated={(row) => {
            upsertSavedSession(row)
            refreshSessions()
          }}
        />
      )}

      {addCommentSession && (
        <AddCommentModal
          session={addCommentSession}
          showToast={showToast}
          onClose={() => setAddCommentSession(null)}
          onUpdated={(row) => {
            upsertSavedSession(row)
            refreshSessions()
          }}
        />
      )}

      {disputeSession && (
        <DisputeModal
          session={disputeSession}
          showToast={showToast}
          onClose={() => setDisputeSession(null)}
          onUpdated={(row) => {
            upsertSavedSession(row)
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
