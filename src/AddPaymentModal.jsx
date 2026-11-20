import { useEffect, useRef, useState } from 'react'
import {
  paymentSources,
  paymentTypes,
  paymentStatuses,
  paymentStatusLabel,
} from './data'
import { createPosPaymentMethod, normalizePaymentMethod, paymentReceiptImgUrl } from './api'

function ReceiptPicker({ previewUrl, fileName, disabled, onPick, onClear, showToast }) {
  const inputRef = useRef(null)
  return (
    <div className="receipt-field full">
      <span className="label-text">Receipt (optional)</span>
      {previewUrl ? (
        <div className="receipt-preview-row">
          <img src={previewUrl} alt="" className="receipt-thumb" />
          <div>
            <p className="muted">{fileName || 'Selected image'}</p>
            <button type="button" className="text-btn" disabled={disabled} onClick={onClear}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn ghost"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Choose image
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          if (!String(file.type || '').startsWith('image/')) {
            showToast('Choose an image file')
            return
          }
          onPick(file)
        }}
      />
    </div>
  )
}

export default function AddPaymentModal({ session, showToast, onClose, onAdded }) {
  const [busy, setBusy] = useState(false)
  const [authCode, setAuthCode] = useState('')
  const [form, setForm] = useState(() => ({
    source: 'pos',
    type: 'massage',
    amount: String(session.amount || ''),
    status: 'pending',
  }))
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState('')

  useEffect(() => {
    return () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview)
    }
  }, [receiptPreview])

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function paymentAuth() {
    const raw = authCode.trim()
    if (!raw) return null
    return /^\d+$/.test(raw) ? { tc: raw } : { th: raw }
  }

  async function submit(e) {
    e?.preventDefault()
    if (busy) return
    if (!session.sessionCode) {
      showToast('Session code required')
      return
    }
    const auth = paymentAuth()
    if (!auth) {
      showToast('Enter creator or admin code')
      return
    }
    const amount = Number(form.amount)
    if (!(amount > 0)) {
      showToast('Amount must be greater than 0')
      return
    }
    setBusy(true)
    try {
      const result = await createPosPaymentMethod({
        session_code: session.sessionCode,
        ...auth,
        payment_method: {
          source: form.source,
          type: form.type,
          amount,
          status: form.status,
        },
        receipt: receiptFile || undefined,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      const row = normalizePaymentMethod(result.paymentMethod)
      onAdded?.(row)
      showToast(
        paymentReceiptImgUrl(row) ? 'Payment method added with receipt' : 'Payment method added',
      )
      onClose()
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
        aria-labelledby="add-payment-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2 id="add-payment-title">Add payment</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted note-intro">
          {[session.clientName || 'Client', session.clientPhone, session.sessionCode]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <form className="session-form" onSubmit={submit}>
          <label className="staff-code-field full">
            <span className="label-text">
              Creator or admin code <em>*</em>
            </span>
            <input
              type="password"
              autoComplete="off"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              placeholder="code"
              required
              autoFocus
            />
          </label>
          <label>
            Source
            <select value={form.source} onChange={(e) => setField('source', e.target.value)}>
              {paymentSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={form.type} onChange={(e) => setField('type', e.target.value)}>
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
              value={form.amount}
              onChange={(e) => setField('amount', e.target.value)}
              required
            />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
              {paymentStatuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <ReceiptPicker
            previewUrl={receiptPreview}
            fileName={receiptFile?.name}
            disabled={busy}
            showToast={showToast}
            onPick={(file) => {
              if (receiptPreview) URL.revokeObjectURL(receiptPreview)
              setReceiptFile(file)
              setReceiptPreview(URL.createObjectURL(file))
            }}
            onClear={() => {
              if (receiptPreview) URL.revokeObjectURL(receiptPreview)
              setReceiptFile(null)
              setReceiptPreview('')
            }}
          />
          <p className="field-hint full">
            Default status: {paymentStatusLabel(form.status) || form.status}
          </p>
          <div className="form-actions full">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={busy || !authCode.trim()}
            >
              {busy ? 'Saving…' : 'Add payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
