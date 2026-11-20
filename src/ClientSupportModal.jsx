import { useEffect, useState } from 'react'
import {
  clientSupportDescriptions,
  clientSupportTypes,
  DEFAULT_CLIENT_SUPPORT_AMOUNT,
  DEFAULT_CLIENT_SUPPORT_TYPE,
} from './data'
import {
  updatePosClientSupport,
  deletePosClientSupport,
  normalizeSession,
} from './api'

function formatMoney(n) {
  return `₦${Number(n || 0).toLocaleString()}`
}

function emptyForm(existing) {
  return {
    id: existing?.id ?? null,
    description: existing?.description || clientSupportDescriptions[0],
    amount: String(
      existing?.amount > 0 ? existing.amount : DEFAULT_CLIENT_SUPPORT_AMOUNT,
    ),
    type: existing?.type || DEFAULT_CLIENT_SUPPORT_TYPE,
    notes: existing?.notes || '',
  }
}

export default function ClientSupportModal({ session, showToast, onClose, onUpdated }) {
  const [supports, setSupports] = useState(() =>
    Array.isArray(session.clientSupports) && session.clientSupports.length
      ? session.clientSupports
      : session.clientSupport
        ? [session.clientSupport]
        : [],
  )
  const [mode, setMode] = useState('list') // list | form
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [th, setTh] = useState('')
  const [form, setForm] = useState(() => emptyForm(null))

  useEffect(() => {
    const next =
      Array.isArray(session.clientSupports) && session.clientSupports.length
        ? session.clientSupports
        : session.clientSupport
          ? [session.clientSupport]
          : []
    setSupports(next)
  }, [session.sessionCode, session.clientSupports, session.clientSupport])

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function applySessionResult(apiSession, toastMsg) {
    const row = normalizeSession(apiSession, {
      clientName: session.clientName,
      clientPhone: session.clientPhone,
      staffCode: session.staffCode,
      paymentMethods: session.paymentMethods,
      sessionTherapists: session.sessionTherapists,
    })
    setSupports(
      Array.isArray(row.clientSupports) && row.clientSupports.length
        ? row.clientSupports
        : row.clientSupport
          ? [row.clientSupport]
          : [],
    )
    onUpdated?.(row)
    showToast(toastMsg)
  }

  function startAdd() {
    setEditingId(null)
    setForm(emptyForm(null))
    setMode('form')
  }

  function startEdit(row) {
    if (row.settled) {
      showToast('Client support is settled and cannot be edited')
      return
    }
    setEditingId(row.id)
    setForm(emptyForm(row))
    setMode('form')
  }

  async function submit(e) {
    e?.preventDefault()
    if (busy) return
    if (!session.sessionCode) {
      showToast('Session code required')
      return
    }
    if (!th.trim()) {
      showToast('Creator therapist code is required')
      return
    }
    const desc = String(form.description || '').trim()
    const amt = Number(form.amount)
    const supportType = String(form.type || '').trim().toLowerCase()
    if (!desc) {
      showToast('Client support description is required')
      return
    }
    if (!(amt > 0)) {
      showToast('Client support amount must be greater than 0')
      return
    }
    if (supportType !== 'payin' && supportType !== 'payout') {
      showToast('Client support type is required')
      return
    }

    const client_support = { description: desc, amount: amt, type: supportType }
    const notesText = String(form.notes || '').trim()
    if (notesText) client_support.notes = notesText
    if (editingId != null) client_support.id = editingId

    setBusy(true)
    try {
      const result = await updatePosClientSupport({
        sessionCode: session.sessionCode,
        ss: session.sessionCode,
        th: th.trim(),
        client_support,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      applySessionResult(
        result.session,
        editingId != null ? 'Client support updated' : 'Client support added',
      )
      setMode('list')
      setEditingId(null)
      setForm(emptyForm(null))
    } catch (err) {
      showToast(err?.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  async function removeSupport(row) {
    if (busy) return
    if (!session.sessionCode) {
      showToast('Session code required')
      return
    }
    if (!th.trim()) {
      showToast('Creator therapist code is required to delete')
      return
    }
    if (row.settled) {
      showToast('Client support is settled and cannot be deleted')
      return
    }
    if (!window.confirm('Delete this client support?')) return

    setBusy(true)
    try {
      const result = await deletePosClientSupport({
        sessionCode: session.sessionCode,
        ss: session.sessionCode,
        th: th.trim(),
        id: row.id,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      applySessionResult(result.session, 'Client support deleted')
      if (editingId === row.id) {
        setMode('list')
        setEditingId(null)
        setForm(emptyForm(null))
      }
    } catch (err) {
      showToast(err?.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card modal-card-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-support-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2 id="client-support-title">Client support</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted note-intro">
          {[session.clientName || 'Client', session.clientPhone, session.sessionCode]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <label className="staff-code-field full" style={{ display: 'block', marginBottom: 12 }}>
          <span className="label-text">
            Creator therapist code <em>*</em>
          </span>
          <input
            type="password"
            autoComplete="off"
            value={th}
            onChange={(e) => setTh(e.target.value)}
            placeholder="ADA1"
            autoFocus={mode === 'list'}
          />
        </label>

        {mode === 'list' ? (
          <>
            <div className="payments-popup-actions">
              <button
                type="button"
                className="btn small primary"
                disabled={busy}
                onClick={startAdd}
              >
                Add client support
              </button>
            </div>
            {supports.length === 0 ? (
              <p className="muted">No client support yet.</p>
            ) : (
              <ul className="payment-list confirm-payment-list">
                {supports.map((row) => (
                  <li key={row.id || `${row.description}-${row.amount}-${row.createdAt}`}>
                    <div className="payment-method-item">
                      <div className="payment-method-main">
                        <strong className="payment-method-amount">
                          {formatMoney(row.amount)}
                        </strong>
                        <span className="payment-method-meta">
                          {[row.description, row.type].filter(Boolean).join(' · ') || '—'}
                        </span>
                        {row.settled ? <span className="badge soft">settled</span> : null}
                      </div>
                    </div>
                    {row.notes ? <p className="muted">{row.notes}</p> : null}
                    <div className="payment-actions">
                      <button
                        type="button"
                        className="text-btn"
                        disabled={busy || row.settled}
                        onClick={() => startEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-btn"
                        disabled={busy || row.settled || !th.trim()}
                        onClick={() => removeSupport(row)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <form className="session-form" onSubmit={submit}>
            <p className="muted note-intro full">
              {editingId != null ? 'Editing client support.' : 'Adding a new client support.'}
            </p>
            <label>
              <span className="label-text">
                Description <em>*</em>
              </span>
              <select
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                required
              >
                {form.description &&
                  !clientSupportDescriptions.includes(form.description) && (
                    <option value={form.description}>{form.description}</option>
                  )}
                {clientSupportDescriptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label-text">
                Amount <em>*</em>
              </span>
              <input
                type="number"
                min="1"
                step="any"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
                placeholder={String(DEFAULT_CLIENT_SUPPORT_AMOUNT)}
                required
              />
            </label>
            <label>
              <span className="label-text">
                Type <em>*</em>
              </span>
              <select
                value={form.type}
                onChange={(e) => setField('type', e.target.value)}
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
              Notes
              <input
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Optional — e.g. Paid from the front desk"
              />
            </label>
            <div className="form-actions full">
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => {
                  setMode('list')
                  setEditingId(null)
                  setForm(emptyForm(null))
                }}
              >
                Back
              </button>
              <button type="submit" className="btn primary" disabled={busy || !th.trim()}>
                {busy ? 'Saving…' : editingId != null ? 'Save changes' : 'Add support'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
