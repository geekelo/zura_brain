import { useEffect, useState } from 'react'
import { paymentStatusBadgeClass, paymentStatusLabel } from './data'
import {
  updatePosPaymentMethod,
  verifyPosSessionPayment,
  normalizePaymentMethod,
  normalizeSession,
  paymentReceiptImgUrl,
} from './api'

function formatMoney(n) {
  return `₦${Number(n || 0).toLocaleString()}`
}

export default function ConfirmPaymentsModal({
  session,
  showToast,
  onClose,
  onSessionUpdated,
  onPaymentUpdated,
}) {
  const [busy, setBusy] = useState(false)
  const [authCode, setAuthCode] = useState('')
  const [payments, setPayments] = useState(() =>
    Array.isArray(session.paymentMethods) ? [...session.paymentMethods] : [],
  )
  const [paymentVerified, setPaymentVerified] = useState(!!session.paymentVerified)

  useEffect(() => {
    setPayments(Array.isArray(session.paymentMethods) ? [...session.paymentMethods] : [])
    setPaymentVerified(!!session.paymentVerified)
  }, [session.sessionCode, session.paymentMethods, session.paymentVerified])

  function paymentAuth() {
    const raw = authCode.trim()
    if (!raw) return null
    return /^\d+$/.test(raw) ? { tc: raw } : { th: raw }
  }

  async function setPaymentStatus(pm, status) {
    if (busy) return
    const auth = paymentAuth()
    if (!auth) {
      showToast('Enter creator or admin code')
      return
    }
    setBusy(true)
    try {
      const result = await updatePosPaymentMethod({
        id: pm.id,
        ...auth,
        payment_method: {
          source: pm.source,
          type: pm.type,
          amount: pm.amount,
          status,
        },
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      const row = normalizePaymentMethod(result.paymentMethod)
      const nextList = payments.map((p) => (p.id === row.id ? row : p))
      setPayments(nextList)
      onPaymentUpdated?.(nextList)
      showToast(status === 'ok' ? 'Payment confirmed' : 'Marked not refunded')
    } catch (err) {
      showToast(err?.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  async function verifySessionPayment(e) {
    e?.preventDefault()
    if (busy) return
    if (!session.sessionCode) {
      showToast('Session code required')
      return
    }
    if (!authCode.trim()) {
      showToast('Enter therapist or admin code')
      return
    }
    setBusy(true)
    try {
      const result = await verifyPosSessionPayment({
        sessionCode: session.sessionCode,
        code: authCode.trim(),
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      const row = normalizeSession(result.session, {
        clientName: session.clientName,
        clientPhone: session.clientPhone,
        staffCode: session.staffCode,
        paymentMethods: payments,
        sessionTherapists: session.sessionTherapists,
      })
      setPaymentVerified(!!row.paymentVerified)
      onSessionUpdated?.(row)
      showToast('Payment verified')
    } catch (err) {
      showToast(err?.message || 'Could not verify payment')
    } finally {
      setBusy(false)
    }
  }

  function settled(status) {
    const key = String(status || '').toLowerCase()
    return key === 'ok' || key === 'nonrefunded'
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card modal-card-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-payments-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2 id="confirm-payments-title">Confirm payments</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted note-intro">
          {[session.clientName || 'Client', session.clientPhone, session.sessionCode]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <label className="staff-code-field full" style={{ display: 'block', marginBottom: 14 }}>
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

        <section className="confirm-payments-section">
          <h3>Payment methods</h3>
          {payments.length === 0 ? (
            <p className="muted">No payment methods yet.</p>
          ) : (
            <ul className="payment-list confirm-payment-list">
              {payments.map((pm) => {
                const done = settled(pm.status)
                const receipt = paymentReceiptImgUrl(pm)
                return (
                  <li key={pm.id}>
                    <div className="payment-method-item">
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
                        <img src={receipt} alt="" className="receipt-thumb" />
                      ) : null}
                    </div>
                    {done ? null : (
                      <div className="payment-actions">
                        <button
                          type="button"
                          className="btn small primary"
                          disabled={busy || !authCode.trim()}
                          onClick={() => setPaymentStatus(pm, 'ok')}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="btn small ghost"
                          disabled={busy || !authCode.trim()}
                          onClick={() => setPaymentStatus(pm, 'nonrefunded')}
                        >
                          Not refunded
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="confirm-payments-section">
          <h3>Session payment</h3>
          {paymentVerified ? (
            <p className="payment-verified-note">Payment verified</p>
          ) : (
            <form className="session-form" onSubmit={verifySessionPayment}>
              <p className="muted note-intro">
                Marks the session as payment verified in session history.
              </p>
              <div className="form-actions full">
                <button
                  type="submit"
                  className="btn primary"
                  disabled={busy || !authCode.trim()}
                >
                  {busy ? 'Verifying…' : 'Verify session payment'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
