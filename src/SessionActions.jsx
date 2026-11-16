import { useEffect, useRef, useState } from 'react'
import {
  sessionTypes,
  massageTypes,
  DEFAULT_MASSAGE_TYPE,
  DEFAULT_AMOUNT,
  amountOptions,
  amountSelectValue,
  DEFAULT_LUNEZ_AMOUNT,
  DEFAULT_LUNEZ_AMOUNT_YES,
  lunezAmountOptions,
  lunezAmountSelectValue,
  toSentenceCase,
  handsOptions,
  paymentSources,
  paymentTypes,
  paymentStatuses,
  paymentStatusLabel,
} from './data'
import {
  updatePosSession,
  deletePosSession,
  replacePosSessionComments,
  resolvePosSessionComment,
  setPosSessionStatus,
  setPosSessionTimes,
  createPosPaymentMethod,
  updatePosPaymentMethod,
  deletePosPaymentMethod,
  createPosAdminNote,
  normalizeSession,
  normalizePaymentMethod,
  paymentReceiptImgUrl,
  hasSessionTime,
  nowTimeOfDay,
  toTimeOfDay,
  formatDuration,
} from './api'

const STATUS_OPTIONS = ['pending', 'started', 'ended', 'completed', 'disputed']

/** YYYY-MM-DD for `<input type="date">` from ISO / session_date. */
function toDateInputValue(value) {
  if (!value) return ''
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10)) && s.length <= 10) return s.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    const head = s.slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : ''
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Apply a new calendar date while keeping the clock time from created_at.
 */
function sessionDateKeepingCreatedTime(dateYmd, createdIso) {
  const [y, mo, day] = String(dateYmd || '')
    .split('-')
    .map(Number)
  if (!y || !mo || !day) return null
  const base = createdIso ? new Date(createdIso) : new Date()
  if (Number.isNaN(base.getTime())) {
    return `${String(dateYmd).slice(0, 10)}T00:00:00.000Z`
  }
  const next = new Date(base.getTime())
  next.setFullYear(y, mo - 1, day)
  return next.toISOString()
}

function emptyUpdate(session) {
  const createdAt = session.createdAt || session.dateTime || ''
  return {
    st: '',
    amount: amountSelectValue(session.amount, DEFAULT_AMOUNT),
    lunez: !!session.lunez,
    lunez_amount: lunezAmountSelectValue(
      session.lunez && !(Number(session.lunezAmount) > 0)
        ? DEFAULT_LUNEZ_AMOUNT_YES
        : session.lunezAmount,
      session.lunez ? DEFAULT_LUNEZ_AMOUNT_YES : DEFAULT_LUNEZ_AMOUNT,
    ),
    session_type: toSentenceCase(session.sessionType) || sessionTypes[0],
    massage_type: session.massageType || DEFAULT_MASSAGE_TYPE,
    session_date: toDateInputValue(session.dateTime || createdAt),
    created_at: createdAt,
    start_time: toTimeOfDay(session.startTime) || '',
    end_time: toTimeOfDay(session.endTime) || '',
    hands: session.hands || '2',
  }
}

function emptyPaymentForm(session) {
  return {
    source: 'pos',
    type: 'massage',
    amount: String(session.amount || ''),
    status: 'ok',
  }
}

function ReceiptCameraModal({ onCapture, onClose, showToast }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
          setReady(true)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            /permission|notallowed|denied/i.test(String(err?.name || err?.message || ''))
              ? 'Camera permission denied'
              : 'Could not open camera',
          )
        }
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  function snap() {
    const video = videoRef.current
    if (!video || !ready) return
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          showToast?.('Could not capture photo')
          return
        }
        const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div
      className="receipt-camera-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Take receipt photo"
      onClick={onClose}
    >
      <div className="receipt-camera-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>Take photo</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {error ? (
          <p className="scan-qr-error">{error}. Use Upload image instead, or try the device camera button.</p>
        ) : (
          <div className="receipt-camera-view">
            <video ref={videoRef} playsInline muted autoPlay className="receipt-camera-video" />
            {!ready ? <p className="muted receipt-camera-waiting">Starting camera…</p> : null}
          </div>
        )}
        <div className="receipt-camera-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={!ready || !!error} onClick={snap}>
            Capture
          </button>
        </div>
      </div>
    </div>
  )
}

function ReceiptImageField({ previewUrl, fileName, onPick, onClear, disabled, showToast }) {
  const uploadRef = useRef(null)
  const cameraFileRef = useRef(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  function handleFileChange(e) {
    const file = e.target.files?.[0] || null
    e.target.value = ''
    if (file) onPick(file)
  }

  return (
    <div className="full receipt-field">
      <span className="receipt-field-label">Receipt image</span>
      <div className="receipt-controls">
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled}
          onChange={handleFileChange}
        />
        {/* Mobile-friendly OS camera / photo picker */}
        <input
          ref={cameraFileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={disabled}
          onChange={handleFileChange}
        />
        <div className="receipt-pick-row">
          <button
            type="button"
            className="btn outline"
            disabled={disabled}
            onClick={() => uploadRef.current?.click()}
          >
            Upload image
          </button>
          <button
            type="button"
            className="btn outline"
            disabled={disabled}
            onClick={() => setCameraOpen(true)}
          >
            Take photo
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={disabled}
            onClick={() => cameraFileRef.current?.click()}
            title="Uses the device camera or photo library"
          >
            Device camera
          </button>
        </div>
        {previewUrl ? (
          <div className="receipt-preview-wrap">
            <img src={previewUrl} alt="Receipt preview" className="receipt-preview" />
            <div className="receipt-preview-meta">
              <span className="muted">{fileName || 'Receipt selected'}</span>
              <button type="button" className="text-btn" disabled={disabled} onClick={onClear}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <p className="field-hint">
            Upload from files, or take a photo with the camera (desktop and mobile).
          </p>
        )}
      </div>
      {cameraOpen ? (
        <ReceiptCameraModal
          showToast={showToast}
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            onPick(file)
            setCameraOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

export default function SessionActions({ session, clientName, onUpdated, onDeleted, onClose, showToast }) {
  const [tab, setTab] = useState('update') // update | status | times | comments | payments | note | delete
  const [busy, setBusy] = useState(false)
  const [updateForm, setUpdateForm] = useState(() => emptyUpdate(session))
  const [statusForm, setStatusForm] = useState({ th: '', tc: '', status: session.status || 'pending' })
  const [timesForm, setTimesForm] = useState(() => ({
    start_time: toTimeOfDay(session.startTime) || '',
    end_time: toTimeOfDay(session.endTime) || '',
  }))
  const [commentName, setCommentName] = useState('')
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState(() =>
    Array.isArray(session.comments) ? [...session.comments] : [],
  )
  const [payments, setPayments] = useState(() =>
    Array.isArray(session.paymentMethods) ? [...session.paymentMethods] : [],
  )
  const [paymentForm, setPaymentForm] = useState(() => emptyPaymentForm(session))
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState('')
  const [editReceiptFile, setEditReceiptFile] = useState(null)
  const [editReceiptPreview, setEditReceiptPreview] = useState('')
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [editPaymentForm, setEditPaymentForm] = useState(null)
  const [adminCode, setAdminCode] = useState('')
  const [paymentAuthCode, setPaymentAuthCode] = useState('')
  const [receiptLightbox, setReceiptLightbox] = useState('')
  const [adminNoteSt, setAdminNoteSt] = useState('')
  const [adminNoteBody, setAdminNoteBody] = useState('')

  /** Prefer explicit tc for numeric admin codes; otherwise th (creator). */
  function paymentAuth() {
    const raw = paymentAuthCode.trim()
    if (!raw) return null
    return /^\d+$/.test(raw) ? { tc: raw } : { th: raw }
  }

  // Keep time fields in sync when session already has start/end (ISO or HH:MM:SS).
  useEffect(() => {
    const start = toTimeOfDay(session.startTime) || ''
    const end = toTimeOfDay(session.endTime) || ''
    setTimesForm({ start_time: start, end_time: end })
    setUpdateForm((f) => ({ ...f, start_time: start, end_time: end }))
  }, [session.sessionCode, session.startTime, session.endTime])

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview)
      if (editReceiptPreview) URL.revokeObjectURL(editReceiptPreview)
    }
  }, [receiptPreview, editReceiptPreview])

  function pickReceipt(file, { forEdit = false } = {}) {
    if (!file) return
    if (!String(file.type || '').startsWith('image/')) {
      showToast('Choose an image file')
      return
    }
    const url = URL.createObjectURL(file)
    if (forEdit) {
      if (editReceiptPreview) URL.revokeObjectURL(editReceiptPreview)
      setEditReceiptFile(file)
      setEditReceiptPreview(url)
      return
    }
    if (receiptPreview) URL.revokeObjectURL(receiptPreview)
    setReceiptFile(file)
    setReceiptPreview(url)
  }

  function clearReceipt({ forEdit = false } = {}) {
    if (forEdit) {
      if (editReceiptPreview) URL.revokeObjectURL(editReceiptPreview)
      setEditReceiptFile(null)
      setEditReceiptPreview('')
      return
    }
    if (receiptPreview) URL.revokeObjectURL(receiptPreview)
    setReceiptFile(null)
    setReceiptPreview('')
  }

  const ss = session.sessionCode
  const title = ss || 'Session'

  function setU(key, value) {
    setUpdateForm((f) => ({ ...f, [key]: value }))
  }

  async function run(action) {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } catch (err) {
      showToast(err?.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  function syncPayments(nextList) {
    setPayments(nextList)
    onUpdated({
      ...session,
      paymentMethods: nextList,
    })
  }

  function applySession(apiSession) {
    const next = normalizeSession(apiSession, {
      clientName: clientName || session.clientName,
      clientPhone: session.clientPhone,
      paymentMethods: payments,
    })
    onUpdated(next)
    setUpdateForm(emptyUpdate(next))
    setStatusForm((f) => ({ ...f, status: next.status }))
    setTimesForm({
      start_time: toTimeOfDay(next.startTime) || '',
      end_time: toTimeOfDay(next.endTime) || '',
    })
    setComments(Array.isArray(next.comments) ? [...next.comments] : [])
    if (Array.isArray(apiSession.payment_methods)) {
      setPayments(next.paymentMethods)
    }
  }

  function setP(key, value) {
    setPaymentForm((f) => ({ ...f, [key]: value }))
  }

  function setEP(key, value) {
    setEditPaymentForm((f) => ({ ...f, [key]: value }))
  }

  function submitCreatePayment(e) {
    e?.preventDefault()
    if (!ss) {
      showToast('Session code required to add payment')
      return
    }
    const auth = paymentAuth()
    if (!auth) {
      showToast('Enter creator or admin code')
      return
    }
    const amount = Number(paymentForm.amount)
    if (!(amount > 0)) {
      showToast('Amount must be greater than 0')
      return
    }
    run(async () => {
      const result = await createPosPaymentMethod({
        session_code: ss,
        ...auth,
        payment_method: {
          source: paymentForm.source,
          type: paymentForm.type,
          amount,
          status: paymentForm.status,
        },
        receipt: receiptFile || undefined,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      const row = normalizePaymentMethod(result.paymentMethod)
      syncPayments([row, ...payments.filter((p) => p.id !== row.id)])
      setPaymentForm(emptyPaymentForm(session))
      clearReceipt()
      showToast(
        paymentReceiptImgUrl(row) ? 'Payment method added with receipt' : 'Payment method added',
      )
    })
  }

  function startEditPayment(pm) {
    clearReceipt({ forEdit: true })
    setEditingPaymentId(pm.id)
    setEditPaymentForm({
      source: pm.source,
      type: pm.type,
      amount: String(pm.amount),
      status: pm.status,
    })
  }

  function cancelEditPayment() {
    clearReceipt({ forEdit: true })
    setEditingPaymentId(null)
    setEditPaymentForm(null)
  }

  function submitEditPayment(e) {
    e?.preventDefault()
    if (!editingPaymentId || !editPaymentForm) return
    const auth = paymentAuth()
    if (!auth) {
      showToast('Enter creator or admin code')
      return
    }
    const amount = Number(editPaymentForm.amount)
    if (!(amount > 0)) {
      showToast('Amount must be greater than 0')
      return
    }
    run(async () => {
      const result = await updatePosPaymentMethod({
        id: editingPaymentId,
        ...auth,
        payment_method: {
          source: editPaymentForm.source,
          type: editPaymentForm.type,
          amount,
          status: editPaymentForm.status,
        },
        receipt: editReceiptFile || undefined,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      const row = normalizePaymentMethod(result.paymentMethod)
      syncPayments(payments.map((p) => (p.id === row.id ? row : p)))
      cancelEditPayment()
      showToast(
        editReceiptFile && paymentReceiptImgUrl(row)
          ? 'Payment method updated with receipt'
          : 'Payment method updated',
      )
    })
  }

  function removePayment(id) {
    const auth = paymentAuth()
    if (!auth) {
      showToast('Enter creator or admin code to delete')
      return
    }
    run(async () => {
      const result = await deletePosPaymentMethod({ id, ...auth })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      syncPayments(payments.filter((p) => p.id !== id))
      if (editingPaymentId === id) cancelEditPayment()
      if (result.delUrls?.length) {
        result.delUrls.forEach((u) => window.open(u, '_blank', 'noopener,noreferrer'))
        showToast('Payment removed. Confirm ImgBB image delete in the opened tab(s).')
      } else {
        showToast(result.message || 'Payment method deleted')
      }
    })
  }

  function submitUpdate(e) {
    e?.preventDefault()
    if (!updateForm.st.trim()) {
      showToast('Creator staff code is required')
      return
    }
    run(async () => {
      const session_date = sessionDateKeepingCreatedTime(
        updateForm.session_date,
        updateForm.created_at || session.createdAt || session.dateTime,
      )
      const result = await updatePosSession({
        sessionCode: ss,
        st: updateForm.st,
        session: {
          amount: updateForm.amount,
          lunez: !!updateForm.lunez,
          ...(updateForm.lunez
            ? {
                lunez_amount: (() => {
                  const amt = Number(updateForm.lunez_amount)
                  return Number.isFinite(amt) && amt > 0 ? amt : DEFAULT_LUNEZ_AMOUNT_YES
                })(),
              }
            : {}),
          session_type: String(updateForm.session_type).toLowerCase(),
          massage_type: String(updateForm.massage_type || '').trim(),
          session_date: session_date || undefined,
          start_time: updateForm.start_time || null,
          end_time: updateForm.end_time || null,
          hands: updateForm.hands,
        },
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      applySession(result.session)
      showToast('Session updated')
    })
  }

  function submitStatus(e) {
    e?.preventDefault()
    const adminOnly =
      statusForm.status === 'completed' || statusForm.status === 'disputed'
    if (adminOnly) {
      if (!statusForm.tc.trim()) {
        showToast('Admin code is required for completed / disputed')
        return
      }
    } else if (!statusForm.th.trim() && !statusForm.tc.trim()) {
      showToast('Enter therapist code or admin code')
      return
    }
    run(async () => {
      const result = await setPosSessionStatus({
        sessionCode: ss,
        th: adminOnly ? undefined : statusForm.th || undefined,
        tc: statusForm.tc || undefined,
        status: statusForm.status,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      applySession(result.session)
      showToast('Status updated')
    })
  }

  function submitTimes(e) {
    e?.preventDefault()
    const start = toTimeOfDay(timesForm.start_time)
    const end = toTimeOfDay(timesForm.end_time)
    if (!start && !end) {
      showToast('Enter a start and/or end time')
      return
    }
    run(async () => {
      const result = await setPosSessionTimes({
        sessionCode: ss,
        start_time: start || undefined,
        end_time: end || undefined,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      applySession(result.session)
      showToast(end ? 'Session ended' : 'Session started')
    })
  }

  function startSessionNow() {
    if (!ss) {
      showToast('Session code required')
      return
    }
    run(async () => {
      const result = await setPosSessionTimes({
        sessionCode: ss,
        start_time: nowTimeOfDay(),
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      applySession(result.session)
      showToast('Session started')
    })
  }

  function endSessionNow() {
    if (!ss) {
      showToast('Session code required')
      return
    }
    const start = toTimeOfDay(session.startTime) || toTimeOfDay(timesForm.start_time)
    if (!start) {
      showToast('Start time is required before ending')
      return
    }
    run(async () => {
      const result = await setPosSessionTimes({
        sessionCode: ss,
        start_time: start,
        end_time: nowTimeOfDay(),
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      applySession(result.session)
      showToast('Session ended')
    })
  }

  function addCommentLocal() {
    if (!commentName.trim() || !commentText.trim()) {
      showToast('Name and comment are required')
      return
    }
    // Omit date_time — API stores current time when saving. resolved defaults to false.
    setComments((list) => [
      ...list,
      {
        name: commentName.trim(),
        comment: commentText.trim(),
        resolved: false,
      },
    ])
    setCommentName('')
    setCommentText('')
  }

  function submitComments(e) {
    e?.preventDefault()
    run(async () => {
      const result = await replacePosSessionComments({
        sessionCode: ss,
        comments,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      applySession(result.session)
      showToast('Comments saved')
    })
  }

  function toggleCommentResolved(index, resolved) {
    if (!ss) {
      showToast('Session code required')
      return
    }
    if (!Number.isInteger(index) || index < 0) {
      showToast('Save comments before resolving')
      return
    }
    run(async () => {
      const result = await resolvePosSessionComment({
        sessionCode: ss,
        index,
        resolved: !!resolved,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      applySession(result.session)
      showToast(resolved ? 'Comment marked resolved' : 'Comment marked unresolved')
    })
  }

  function submitDelete(e) {
    e?.preventDefault()
    if (!adminCode.trim()) {
      showToast('Admin code is required')
      return
    }
    run(async () => {
      if (!ss) {
        showToast('Session code required')
        return
      }
      const result = await deletePosSession({ sessionCode: ss, code: adminCode })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      showToast(result.message || 'Session deleted')
      onDeleted(ss)
      onClose()
    })
  }

  function submitAdminNote(e) {
    e?.preventDefault()
    if (!ss) {
      showToast('Session code required')
      return
    }
    if (!adminNoteSt.trim()) {
      showToast('Enter your therapist code')
      return
    }
    if (!adminNoteBody.trim()) {
      showToast('Write a note first')
      return
    }
    run(async () => {
      const result = await createPosAdminNote({
        st: adminNoteSt.trim(),
        ss,
        admin_note: { body: adminNoteBody.trim(), status: 'open' },
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      setAdminNoteBody('')
      showToast('Admin note created for this session')
    })
  }

  const tabs = [
    { id: 'update', label: 'Update' },
    { id: 'status', label: 'Status' },
    { id: 'times', label: 'Times' },
    { id: 'comments', label: 'Comments' },
    { id: 'payments', label: 'Payments' },
    { id: 'note', label: 'Admin note' },
    { id: 'delete', label: 'Delete' },
  ]

  const isConfirmed = String(session.status || '').toLowerCase() === 'confirmed'
  const hasStart = hasSessionTime(session.startTime)
  const hasEnd = hasSessionTime(session.endTime)
  const showStartBtn = !isConfirmed && !hasStart
  const showEndBtn = !isConfirmed && hasStart && !hasEnd

  return (
    <section className="card panel-card session-actions">
      <div className="panel-head">
        <h2>
          Session {title}
          <span className="badge soft" style={{ marginLeft: 8 }}>
            {session.status}
          </span>
        </h2>
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="session-summary">
        <p className="session-summary-title">
          {[clientName || session.clientName || 'Client', session.clientPhone]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <dl className="session-summary-grid">
          <div>
            <dt>Service</dt>
            <dd>
              {[session.sessionType, session.massageType].filter(Boolean).join(' · ') || '—'}
            </dd>
          </div>
          <div>
            <dt>Cycle</dt>
            <dd>
              {session.cycleNum != null
                ? `${session.cycleNum}/4`
                : session.cycle || '—'}
            </dd>
          </div>
          {session.hands ? (
            <div>
              <dt>Hands</dt>
              <dd>{session.hands} hands</dd>
            </div>
          ) : null}
          <div>
            <dt>Start</dt>
            <dd>{session.startTime || '—'}</dd>
          </div>
          <div>
            <dt>End</dt>
            <dd>{session.endTime || '—'}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd className="session-duration">{formatDuration(session.duration)}</dd>
          </div>
          {session.lunez ? (
            <div>
              <dt>Lunez</dt>
              <dd>{Number(session.lunezAmount || 0).toLocaleString()}</dd>
            </div>
          ) : null}
          {session.therapistLabel ? (
            <div className="full">
              <dt>Therapists</dt>
              <dd>{session.therapistLabel}</dd>
            </div>
          ) : null}
          {session.sessionCreatorName ? (
            <div className="full">
              <dt>Created by</dt>
              <dd>{session.sessionCreatorName}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {(showStartBtn || showEndBtn) && (
        <div className="session-time-actions">
          {showStartBtn && (
            <button type="button" className="btn primary" disabled={busy || !ss} onClick={startSessionNow}>
              {busy ? 'Starting…' : 'Start'}
            </button>
          )}
          {showEndBtn && (
            <button type="button" className="btn primary" disabled={busy || !ss} onClick={endSessionNow}>
              {busy ? 'Ending…' : 'End'}
            </button>
          )}
          <span className="field-hint">
            {showStartBtn
              ? 'Sets start_time now (HH:MM:SS) and status to started'
              : 'Sends start + end times; status becomes ended'}
          </span>
        </div>
      )}

      <div className="action-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'update' && (
        <form className="session-form" onSubmit={submitUpdate}>
          <label className="staff-code-field">
            Creator code <em style={{ color: '#dc2626' }}>*</em>
            <input
              type="password"
              autoComplete="off"
              value={updateForm.st}
              onChange={(e) => setU('st', e.target.value)}
              placeholder="ADA1"
              required
            />
          </label>
          <label>
            Session type
            <select
              value={updateForm.session_type}
              onChange={(e) => setU('session_type', e.target.value)}
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
              value={updateForm.massage_type}
              onChange={(e) => setU('massage_type', e.target.value)}
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
            <select value={amountSelectValue(updateForm.amount)} onChange={(e) => setU('amount', e.target.value)}>
              {!amountOptions.includes(Number(updateForm.amount)) && updateForm.amount !== '' && (
                <option value={String(Number(updateForm.amount))}>
                  {Number(updateForm.amount).toLocaleString()}
                </option>
              )}
              {amountOptions.map((a) => (
                <option key={a} value={String(a)}>
                  {a.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hands
            <select value={updateForm.hands} onChange={(e) => setU('hands', e.target.value)}>
              {updateForm.hands && !handsOptions.includes(String(updateForm.hands)) && (
                <option value={String(updateForm.hands)}>{updateForm.hands}</option>
              )}
              {handsOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <label>
            Session date
            <input
              type="date"
              value={updateForm.session_date || ''}
              onChange={(e) => setU('session_date', e.target.value)}
            />
            <span className="field-hint">Time stays as when the session was created</span>
          </label>
          <fieldset className="seg">
            <legend>Lunez</legend>
            <button
              type="button"
              className={updateForm.lunez ? 'active' : ''}
              onClick={() =>
                setUpdateForm((f) => ({
                  ...f,
                  lunez: true,
                  lunez_amount: String(DEFAULT_LUNEZ_AMOUNT_YES),
                }))
              }
            >
              Yes
            </button>
            <button
              type="button"
              className={!updateForm.lunez ? 'active' : ''}
              onClick={() =>
                setUpdateForm((f) => ({
                  ...f,
                  lunez: false,
                  lunez_amount: String(DEFAULT_LUNEZ_AMOUNT),
                }))
              }
            >
              No
            </button>
          </fieldset>
          {updateForm.lunez && (
            <label>
              Lunez amount
              <select
                value={lunezAmountSelectValue(updateForm.lunez_amount)}
                onChange={(e) => setU('lunez_amount', e.target.value)}
                required
              >
                {!lunezAmountOptions.includes(Number(updateForm.lunez_amount)) &&
                  updateForm.lunez_amount !== '' && (
                    <option value={String(Number(updateForm.lunez_amount))}>
                      {Number(updateForm.lunez_amount).toLocaleString()}
                    </option>
                  )}
                {lunezAmountOptions.map((a) => (
                  <option key={a} value={String(a)}>
                    {a.toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Start time
            <input
              type="time"
              step="1"
              value={toTimeOfDay(updateForm.start_time)}
              onChange={(e) => setU('start_time', e.target.value)}
            />
          </label>
          <label>
            End time
            <input
              type="time"
              step="1"
              value={toTimeOfDay(updateForm.end_time)}
              onChange={(e) => setU('end_time', e.target.value)}
            />
          </label>
          <div className="form-actions full">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Update session'}
            </button>
          </div>
        </form>
      )}

      {tab === 'status' && (
        <form className="session-form" onSubmit={submitStatus}>
          <label>
            Status
            <select
              value={statusForm.status}
              onChange={(e) => {
                const status = e.target.value
                const adminOnly = status === 'completed' || status === 'disputed'
                setStatusForm((f) => ({
                  ...f,
                  status,
                  ...(adminOnly ? { th: '' } : {}),
                }))
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {statusForm.status !== 'completed' && statusForm.status !== 'disputed' && (
            <label className="staff-code-field">
              Therapist code
              <input
                type="password"
                autoComplete="off"
                value={statusForm.th}
                onChange={(e) => setStatusForm((f) => ({ ...f, th: e.target.value, tc: '' }))}
                placeholder="ADA1"
              />
            </label>
          )}
          <label className="staff-code-field">
            <span>
              {statusForm.status === 'completed' || statusForm.status === 'disputed'
                ? 'Admin code'
                : 'Or admin code'}
              {(statusForm.status === 'completed' || statusForm.status === 'disputed') && (
                <em style={{ color: '#dc2626' }}> *</em>
              )}
            </span>
            <input
              type="password"
              autoComplete="off"
              value={statusForm.tc}
              onChange={(e) =>
                setStatusForm((f) => ({ ...f, tc: e.target.value, th: '' }))
              }
              placeholder="123456"
              required={
                statusForm.status === 'completed' || statusForm.status === 'disputed'
              }
            />
          </label>
          <div className="form-actions full">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Set status'}
            </button>
          </div>
        </form>
      )}

      {tab === 'times' && (
        <form className="session-form times-form" onSubmit={submitTimes}>
          <p className="muted note-intro full">
            Times use `HH:MM:SS`. Start alone → started. Both times → ended + duration.
            {isConfirmed && ' Confirmed sessions cannot be started or ended here.'}
          </p>
          {(showStartBtn || showEndBtn) && (
            <div className="session-time-actions full">
              {showStartBtn && (
                <button type="button" className="btn primary" disabled={busy || !ss} onClick={startSessionNow}>
                  {busy ? 'Starting…' : 'Start now'}
                </button>
              )}
              {showEndBtn && (
                <button type="button" className="btn primary" disabled={busy || !ss} onClick={endSessionNow}>
                  {busy ? 'Ending…' : 'End now'}
                </button>
              )}
            </div>
          )}
          <label>
            Start time
            <input
              type="time"
              step="1"
              value={toTimeOfDay(timesForm.start_time)}
              onChange={(e) => setTimesForm((f) => ({ ...f, start_time: e.target.value }))}
              disabled={isConfirmed}
            />
            <span className="field-hint">Required alone to start</span>
          </label>
          <label>
            End time
            <input
              type="time"
              step="1"
              value={toTimeOfDay(timesForm.end_time)}
              onChange={(e) => setTimesForm((f) => ({ ...f, end_time: e.target.value }))}
              disabled={isConfirmed || !hasStart}
            />
            <span className="field-hint">Send with start_time to end</span>
          </label>
          <div className="times-duration full">
            <span className="times-duration-label">Duration</span>
            <strong className="times-duration-value">{formatDuration(session.duration)}</strong>
          </div>
          <div className="form-actions full">
            <button type="submit" className="btn primary" disabled={busy || isConfirmed}>
              {busy ? 'Saving…' : 'Set times'}
            </button>
          </div>
        </form>
      )}

      {tab === 'comments' && (
        <form className="create-form" onSubmit={submitComments}>
          <ul className="comment-list">
            {comments.length === 0 && <li className="muted">No comments yet.</li>}
            {comments.map((c, i) => (
              <li
                key={`${c.date_time || c.name}-${i}`}
                className={c.resolved ? 'comment-resolved' : ''}
              >
                <div className="comment-head">
                  <strong>{c.name}</strong>
                  {c.date_time ? (
                    <span className="muted"> · {new Date(c.date_time).toLocaleString()}</span>
                  ) : (
                    <span className="muted"> · pending save</span>
                  )}
                  {c.resolved ? (
                    <span className="badge soft comment-resolved-badge">resolved</span>
                  ) : null}
                </div>
                <p>{c.comment}</p>
                <div className="comment-actions">
                  {c.date_time ? (
                    <button
                      type="button"
                      className="text-btn"
                      disabled={busy}
                      onClick={() => toggleCommentResolved(i, !c.resolved)}
                    >
                      {c.resolved ? 'Mark unresolved' : 'Mark resolved'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setComments((list) => list.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="create-row two">
            <label>
              Name
              <input
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                placeholder="Staff name"
              />
            </label>
            <label>
              Comment
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Note…"
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={addCommentLocal}>
              Add to list
            </button>
            <button type="submit" className="btn primary" disabled={busy || !ss}>
              {busy ? 'Saving…' : 'Save comments'}
            </button>
          </div>
          <p className="field-hint">
            Saves replace the full comments list — keep existing entries you want to retain.
          </p>
        </form>
      )}

      {tab === 'payments' && (
        <div className="payments-panel">
          <label className="staff-code-field full" style={{ display: 'block', marginBottom: 12 }}>
            <span>
              Creator or admin code <em style={{ color: '#dc2626' }}>*</em>
            </span>
            <input
              type="password"
              autoComplete="off"
              value={paymentAuthCode}
              onChange={(e) => setPaymentAuthCode(e.target.value)}
              placeholder="code"
              required
            />
            <span className="field-hint">
              Required for add, edit, receipt upload, and delete. Admin delete also removes ImgBB images.
            </span>
          </label>
          <ul className="payment-list">
            {payments.length === 0 && <li className="muted">No payment methods yet.</li>}
            {payments.map((pm) => (
              <li key={pm.id}>
                {editingPaymentId === pm.id && editPaymentForm ? (
                  <form className="session-form payment-edit" onSubmit={submitEditPayment}>
                    <label>
                      Source
                      <select value={editPaymentForm.source} onChange={(e) => setEP('source', e.target.value)}>
                        {paymentSources.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Type
                      <select value={editPaymentForm.type} onChange={(e) => setEP('type', e.target.value)}>
                        {paymentTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Amount
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={editPaymentForm.amount}
                        onChange={(e) => setEP('amount', e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Status
                      <select value={editPaymentForm.status} onChange={(e) => setEP('status', e.target.value)}>
                        {paymentStatuses.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {paymentReceiptImgUrl(pm) ? (
                      <p className="muted note-intro full">
                        Current receipt:{' '}
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => setReceiptLightbox(paymentReceiptImgUrl(pm))}
                        >
                          View
                        </button>
                      </p>
                    ) : (
                      <ReceiptImageField
                        previewUrl={editReceiptPreview}
                        fileName={editReceiptFile?.name}
                        disabled={busy}
                        showToast={showToast}
                        onPick={(file) => pickReceipt(file, { forEdit: true })}
                        onClear={() => clearReceipt({ forEdit: true })}
                      />
                    )}
                    <div className="form-actions full">
                      <button type="button" className="btn ghost" onClick={cancelEditPayment}>
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn primary"
                        disabled={busy || !paymentAuthCode.trim()}
                      >
                        {busy ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="payment-method-item">
                      <div className="payment-method-main">
                        <strong className="payment-method-amount">
                          ₦{Number(pm.amount).toLocaleString()}
                        </strong>
                        <span className="payment-method-meta">
                          {[pm.source, pm.type].filter(Boolean).join(' · ') || '—'}
                        </span>
                        {pm.status ? (
                          <span className="badge soft">{paymentStatusLabel(pm.status)}</span>
                        ) : null}
                      </div>
                      {paymentReceiptImgUrl(pm) ? (
                        <button
                          type="button"
                          className="receipt-thumb-btn"
                          onClick={() => setReceiptLightbox(paymentReceiptImgUrl(pm))}
                          aria-label="View receipt"
                        >
                          <img
                            src={paymentReceiptImgUrl(pm)}
                            alt=""
                            className="receipt-thumb"
                          />
                        </button>
                      ) : null}
                    </div>
                    <div className="payment-actions">
                      <button type="button" className="text-btn" onClick={() => startEditPayment(pm)} disabled={busy}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => removePayment(pm.id)}
                        disabled={busy || !paymentAuthCode.trim()}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          <form className="session-form" onSubmit={submitCreatePayment}>
            <p className="muted note-intro">Add how payment was made for this session.</p>
            <label>
              Source
              <select value={paymentForm.source} onChange={(e) => setP('source', e.target.value)}>
                {paymentSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select value={paymentForm.type} onChange={(e) => setP('type', e.target.value)}>
                {paymentTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input
                type="number"
                min="1"
                step="any"
                value={paymentForm.amount}
                onChange={(e) => setP('amount', e.target.value)}
                required
              />
            </label>
            <label>
              Status
              <select value={paymentForm.status} onChange={(e) => setP('status', e.target.value)}>
                {paymentStatuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <ReceiptImageField
              previewUrl={receiptPreview}
              fileName={receiptFile?.name}
              disabled={busy}
              showToast={showToast}
              onPick={(file) => pickReceipt(file)}
              onClear={() => clearReceipt()}
            />
            <div className="form-actions full">
              <button
                type="submit"
                className="btn primary"
                disabled={busy || !ss || !paymentAuthCode.trim()}
              >
                {busy ? 'Saving…' : 'Add payment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'note' && (
        <form className="session-form" onSubmit={submitAdminNote}>
          <p className="muted note-intro full">
            Create an admin note linked to this session ({ss || '—'}).
          </p>
          <label className="staff-code-field">
            <span>
              Your therapist code <em style={{ color: '#dc2626' }}>*</em>
            </span>
            <input
              type="password"
              autoComplete="off"
              value={adminNoteSt}
              onChange={(e) => setAdminNoteSt(e.target.value)}
              placeholder="code"
              required
            />
          </label>
          <label className="full">
            Note
            <textarea
              rows={4}
              maxLength={500}
              value={adminNoteBody}
              onChange={(e) => setAdminNoteBody(e.target.value)}
              placeholder="e.g. Payment was short"
              required
            />
          </label>
          <div className="form-actions full">
            <button
              type="submit"
              className="btn primary"
              disabled={busy || !ss || !adminNoteSt.trim() || !adminNoteBody.trim()}
            >
              {busy ? 'Sending…' : 'Send admin note'}
            </button>
          </div>
        </form>
      )}

      {tab === 'delete' && (
        <form className="session-form" onSubmit={submitDelete}>
          <p className="muted">
            Deletes session {ss || '—'}. Requires admin code. Remaining client sessions are renumbered.
          </p>
          <label className="staff-code-field full">
            Admin code <em style={{ color: '#dc2626' }}>*</em>
            <input
              type="password"
              autoComplete="off"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder="123456"
              required
            />
          </label>
          <div className="form-actions full">
            <button type="submit" className="btn primary" disabled={busy} style={{ background: '#b91c1c' }}>
              {busy ? 'Deleting…' : 'Delete session'}
            </button>
          </div>
        </form>
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
    </section>
  )
}
