import { useEffect, useState } from 'react'
import {
  addPosDisputeThread,
  createPosDispute,
  deletePosDisputeThread,
  resolvePosDispute,
  updatePosDispute,
  updatePosDisputeThread,
} from './api'

function formatWhen(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DisputeModal({ session, showToast, onClose, onUpdated }) {
  const [disputes, setDisputes] = useState(() => session.disputes || [])
  const [adminCode, setAdminCode] = useState('')
  const [name, setName] = useState('')
  const [therapistCode, setTherapistCode] = useState('')
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [description, setDescription] = useState('')
  const [resolution, setResolution] = useState('')
  const [resolutionImages, setResolutionImages] = useState([])
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDisputes(session.disputes || [])
  }, [session.sessionCode, session.disputes])

  const admin = adminCode.trim().length > 0

  function publish(nextDisputes, toast) {
    setDisputes(nextDisputes)
    onUpdated?.({
      ...session,
      disputes: nextDisputes,
      sessionHistory: { ...(session.sessionHistory || {}), disputed: true },
    })
    if (toast) showToast(toast)
  }

  function replaceDispute(next) {
    publish(disputes.map((row) => (row.id === next.id ? next : row)))
  }

  async function run(action, toast) {
    setBusy(true)
    try {
      const result = await action()
      if (!result.ok) {
        showToast(result.error)
        return null
      }
      if (toast) showToast(toast)
      return result.dispute
    } catch (err) {
      showToast(err?.message || 'Network error')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function raise(event) {
    event.preventDefault()
    const created = await run(
      () => createPosDispute({
        code: adminCode.trim(),
        ss: session.sessionCode,
        description,
      }),
      'Dispute raised',
    )
    if (!created) return
    setDescription('')
    publish([created, ...disputes.filter((row) => row.id !== created.id)])
  }

  async function saveDescription(dispute) {
    const next = await run(
      () => updatePosDispute({
        id: dispute.id,
        code: adminCode.trim(),
        description: drafts[`description-${dispute.id}`] ?? dispute.description,
      }),
      'Description saved',
    )
    if (next) replaceDispute(next)
  }

  async function resolve(dispute) {
    const next = await run(
      () => resolvePosDispute({
        id: dispute.id,
        code: adminCode.trim(),
        text: resolution,
        imageUrls: dispute.resolution?.imageUrls || [],
        images: resolutionImages,
      }),
      'Dispute resolved',
    )
    if (!next) return
    setResolution('')
    setResolutionImages([])
    replaceDispute(next)
  }

  async function addThread(dispute, event) {
    event.preventDefault()
    const next = await run(
      () => addPosDisputeThread({
        id: dispute.id,
        th: therapistCode.trim(),
        name: name.trim(),
        text: text.trim(),
        image,
      }),
      'Thread added',
    )
    if (!next) return
    setText('')
    setImage(null)
    replaceDispute(next)
  }

  async function saveThread(dispute, index) {
    const next = await run(
      () => updatePosDisputeThread({
        id: dispute.id,
        index,
        code: adminCode.trim(),
        text: drafts[`${dispute.id}-${index}`] ?? dispute.thread[index]?.text,
      }),
      'Thread updated',
    )
    if (next) replaceDispute(next)
  }

  async function removeThread(dispute, index) {
    const next = await run(
      () => deletePosDisputeThread({ id: dispute.id, index, code: adminCode.trim() }),
      'Thread deleted',
    )
    if (next) replaceDispute(next)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card modal-card-wide modal-card-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-head">
          <h2 id="dispute-title">Dispute</h2>
          <button type="button" className="text-btn" onClick={onClose}>Close</button>
        </div>
        <p className="muted note-intro">
          {[session.clientName || 'Client', session.sessionCode].filter(Boolean).join(' · ')}
        </p>

        <label className="staff-code-field full" style={{ display: 'block', marginBottom: 12 }}>
          <span className="label-text">Admin code</span>
          <input
            type="password"
            autoComplete="off"
            value={adminCode}
            onChange={(event) => setAdminCode(event.target.value)}
            placeholder="Required to resolve, edit, or delete"
          />
        </label>

        {disputes.length === 0 ? <p className="muted">No dispute has been raised yet.</p> : null}

        {admin ? (
          <form onSubmit={raise} className="stack-form">
            <label className="full">
              <span className="label-text">Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} required />
            </label>
            <button type="submit" className="btn small primary" disabled={busy}>Raise dispute</button>
          </form>
        ) : null}

        {disputes.map((dispute) => (
          <section key={dispute.id} className="dispute-block">
            <p>
              <strong>{dispute.description}</strong>{' '}
              <span className={`badge ${dispute.resolved ? 'done' : 'pending'}`}>
                {dispute.resolved ? 'resolved' : 'open'}
              </span>
            </p>
            {dispute.assignedStaff?.length ? (
              <p className="muted">
                Assigned {dispute.assignedStaff.map((staff) => staff.work_name).filter(Boolean).join(', ')}
              </p>
            ) : null}
            {dispute.resolution?.text ? <p>{dispute.resolution.text}</p> : null}
            {dispute.resolution?.imageUrls?.length ? (
              <div className="payment-methods-list">
                {dispute.resolution.imageUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="" className="receipt-thumb" />
                  </a>
                ))}
              </div>
            ) : null}

            {admin ? (
              <div className="stack-form">
                <label className="full">
                  <span className="label-text">Edit description</span>
                  <textarea
                    value={drafts[`description-${dispute.id}`] ?? dispute.description}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [`description-${dispute.id}`]: event.target.value,
                    }))}
                  />
                </label>
                <button type="button" className="btn small ghost" disabled={busy} onClick={() => saveDescription(dispute)}>
                  Save description
                </button>
                <label className="full">
                  <span className="label-text">Resolution</span>
                  <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} />
                </label>
                <label className="full">
                  <span className="label-text">Resolution images</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => setResolutionImages(Array.from(event.target.files || []))}
                  />
                </label>
                <button type="button" className="btn small primary" disabled={busy} onClick={() => resolve(dispute)}>
                  Resolve
                </button>
              </div>
            ) : null}

            <ul className="payment-list">
              {dispute.thread.map((entry, index) => (
                <li key={`${entry.datetime || 'message'}-${index}`}>
                  <strong>{entry.name || 'Staff'}</strong>
                  <span className="muted"> {formatWhen(entry.datetime)}</span>
                  <p>{entry.text}</p>
                  {entry.imageUrl ? (
                    <a href={entry.imageUrl} target="_blank" rel="noreferrer">
                      <img src={entry.imageUrl} alt="" className="receipt-thumb" />
                    </a>
                  ) : null}
                  {admin ? (
                    <div className="stack-form">
                      <textarea
                        value={drafts[`${dispute.id}-${index}`] ?? entry.text}
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [`${dispute.id}-${index}`]: event.target.value,
                        }))}
                      />
                      <div className="payment-actions">
                        <button type="button" className="btn small ghost" disabled={busy} onClick={() => saveThread(dispute, index)}>
                          Save
                        </button>
                        <button type="button" className="btn small ghost" disabled={busy} onClick={() => removeThread(dispute, index)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>

            <form onSubmit={(event) => addThread(dispute, event)} className="stack-form">
              <label className="full">
                <span className="label-text">Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label className="full">
                <span className="label-text">Therapist code</span>
                <input value={therapistCode} onChange={(event) => setTherapistCode(event.target.value)} required />
              </label>
              <label className="full">
                <span className="label-text">Message</span>
                <textarea value={text} onChange={(event) => setText(event.target.value)} required />
              </label>
              <label className="full">
                <span className="label-text">Image</span>
                <input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] || null)} />
              </label>
              <button type="submit" className="btn small primary" disabled={busy}>Add thread</button>
            </form>
          </section>
        ))}
      </div>
    </div>
  )
}
