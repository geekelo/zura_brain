import { useState } from 'react'
import { replacePosSessionComments, normalizeSession } from './api'

export default function AddCommentModal({ session, showToast, onClose, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const existing = Array.isArray(session.comments) ? session.comments : []

  async function submit(e) {
    e?.preventDefault()
    if (busy) return
    if (!session.sessionCode) {
      showToast('Session code required')
      return
    }
    if (!name.trim() || !comment.trim()) {
      showToast('Name and comment are required')
      return
    }

    const nextComments = [
      ...existing.map((c) => ({
        name: c.name,
        comment: c.comment,
        date_time: c.date_time || c.dateTime,
        resolved: !!c.resolved,
      })),
      {
        name: name.trim(),
        comment: comment.trim(),
        resolved: false,
      },
    ]

    setBusy(true)
    try {
      const result = await replacePosSessionComments({
        sessionCode: session.sessionCode,
        comments: nextComments,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      const row = normalizeSession(result.session, {
        clientName: session.clientName,
        clientPhone: session.clientPhone,
        staffCode: session.staffCode,
        paymentMethods: session.paymentMethods,
        sessionTherapists: session.sessionTherapists,
      })
      onUpdated?.(row)
      showToast('Comment added')
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
        aria-labelledby="add-comment-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2 id="add-comment-title">Add comment</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted note-intro">
          {[session.clientName || 'Client', session.clientPhone, session.sessionCode]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {existing.length > 0 ? (
          <ul className="comment-list add-comment-existing">
            {existing.map((c, i) => (
              <li
                key={`${c.date_time || c.dateTime || c.name}-${i}`}
                className={c.resolved ? 'comment-resolved' : ''}
              >
                <div className="comment-head">
                  <strong>{c.name || '—'}</strong>
                  {c.date_time || c.dateTime ? (
                    <span className="muted">
                      {' '}
                      · {new Date(c.date_time || c.dateTime).toLocaleString()}
                    </span>
                  ) : null}
                  {c.resolved ? (
                    <span className="badge soft comment-resolved-badge">resolved</span>
                  ) : null}
                </div>
                <p>{c.comment}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted note-intro">No comments yet.</p>
        )}

        <form className="session-form" onSubmit={submit}>
          <label className="full">
            <span className="label-text">
              Name <em>*</em>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Staff name"
              required
              autoFocus
            />
          </label>
          <label className="full">
            <span className="label-text">
              Comment <em>*</em>
            </span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Note…"
              rows={4}
              required
            />
          </label>
          <div className="form-actions full">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={busy || !name.trim() || !comment.trim()}
            >
              {busy ? 'Saving…' : 'Add comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
