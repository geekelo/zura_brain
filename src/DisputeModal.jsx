import { useEffect, useState } from 'react'
import {
  addPosDisputeThread,
  createPosDispute,
  resolvePosDispute,
  updatePosDispute,
} from './api'
import IconButton, { IconComment } from './IconButton'

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

function disputeTitle(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return 'Dispute'
  const day = date.getDate()
  const mod = day % 10
  const suffix = day % 100 >= 11 && day % 100 <= 13
    ? 'th'
    : mod === 1
      ? 'st'
      : mod === 2
        ? 'nd'
        : mod === 3
          ? 'rd'
          : 'th'
  const month = date.toLocaleDateString('en-GB', { month: 'short' })
  return `Dispute ${day}${suffix} ${month} ${date.getFullYear()}`
}

function IconResolve({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.2 12.2 10.8 14.8 15.8 9.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconView({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.8 12S6.2 6.5 12 6.5 21.2 12 21.2 12 17.8 17.5 12 17.5 2.8 12 2.8 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function IconImage() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="1.4" fill="currentColor" />
      <path d="M7 16.5 10.2 13l2.2 2.2 1.6-1.6L17 16.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}

function IconSave() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4.5h9.2L19 8.3V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V6A1.5 1.5 0 0 1 6.5 4.5H6Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 4.5V9h7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 19v-5h8v5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12 20 4l-6.2 16-2.3-6.3L4 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}

function IconPerson({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconKey({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8.2" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 12h8.5M16.2 12v2.6M19 12v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconBubbles() {
  return (
    <svg width="42" height="32" viewBox="0 0 42 32" fill="none" aria-hidden="true">
      <path d="M8 6.5h16a5 5 0 0 1 5 5v6.2a5 5 0 0 1-5 5H15l-5.2 4.2A1 1 0 0 1 8 25.8V6.5Z" fill="#ddd6fe" />
      <circle cx="13" cy="14" r="1.3" fill="#7c3aed" />
      <circle cx="16.6" cy="14" r="1.3" fill="#7c3aed" />
      <circle cx="20.2" cy="14" r="1.3" fill="#7c3aed" />
      <path d="M20 4h14a5 5 0 0 1 5 5v5.5a5 5 0 0 1-5 5h-6.2" stroke="#c4b5fd" strokeWidth="1.6" />
    </svg>
  )
}

function ThreadList({ dispute, emptyHint }) {
  if (!dispute.thread.length) {
    return (
      <div className="dispute-empty">
        <IconBubbles />
        <p><strong>No threads yet.</strong></p>
        <p>{emptyHint || 'Start a conversation by adding a thread below.'}</p>
      </div>
    )
  }
  return (
    <ul className="dispute-messages">
      {dispute.thread.map((entry, index) => (
        <li key={`${entry.datetime || 'message'}-${index}`} className="dispute-message">
          <div className="dispute-message-meta">
            <strong>{entry.name || 'Staff'}</strong>
            <span>{formatWhen(entry.datetime)}</span>
          </div>
          <p>{entry.text}</p>
          {entry.imageUrl ? (
            <a href={entry.imageUrl} target="_blank" rel="noreferrer">
              <img src={entry.imageUrl} alt="" className="receipt-thumb" />
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export default function DisputeModal({ session, showToast, onClose, onUpdated }) {
  const [disputes, setDisputes] = useState(() => session.disputes || [])
  const [adminCode, setAdminCode] = useState('')
  const [description, setDescription] = useState('')
  const [composers, setComposers] = useState({})
  const [resolution, setResolution] = useState('')
  const [resolutionImages, setResolutionImages] = useState([])
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(false)
  const [focusId, setFocusId] = useState(null)
  const [view, setView] = useState(null)
  const [threadOpen, setThreadOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    setDisputes(session.disputes || [])
  }, [session.sessionCode, session.disputes])

  const openDisputes = disputes.filter((row) => !row.resolved)
  const resolvedDisputes = disputes.filter((row) => row.resolved)
  const focused = disputes.find((row) => row.id === focusId) || null

  function composer(id) {
    return composers[id] || { name: '', th: '', text: '', image: null, imageKey: 0 }
  }

  function patchComposer(id, patch) {
    setComposers((current) => ({
      ...current,
      [id]: { name: '', th: '', text: '', image: null, imageKey: 0, ...current[id], ...patch },
    }))
  }

  function pickThreadImage(id, file) {
    if (!file) {
      patchComposer(id, { image: null })
      return
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      showToast('Use a JPG or PNG image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be 5 MB or smaller')
      return
    }
    patchComposer(id, { image: file })
  }

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

  function openDispute(dispute, nextView) {
    setResolution('')
    setResolutionImages([])
    setThreadOpen(false)
    setView(nextView)
    setFocusId(dispute.id)
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
    if (!adminCode.trim()) {
      showToast('Admin code is required to add a description')
      return
    }
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
    setAddOpen(false)
    publish([created, ...disputes.filter((row) => row.id !== created.id)])
  }

  async function saveDescription(dispute) {
    if (!adminCode.trim()) {
      showToast('Admin code is required to save the description')
      return
    }
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
    if (!adminCode.trim()) {
      showToast('Admin code is required to resolve a dispute')
      return
    }
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
    const draft = composer(dispute.id)
    if (!draft.th.trim()) {
      showToast('Therapist code is required to add a thread')
      return
    }
    if (!draft.name.trim() || !draft.text.trim()) {
      showToast('Name and message are required')
      return
    }
    const next = await run(
      () => addPosDisputeThread({
        id: dispute.id,
        th: draft.th.trim(),
        name: draft.name.trim(),
        text: draft.text.trim(),
        image: draft.image,
      }),
      'Thread added',
    )
    if (!next) return
    patchComposer(dispute.id, {
      text: '',
      image: null,
      imageKey: (draft.imageKey || 0) + 1,
    })
    setThreadOpen(false)
    replaceDispute(next)
  }

  function renderRow(dispute) {
    const threadCount = dispute.thread.length
    const threadLabel = threadCount === 1 ? '1 thread' : `${threadCount} threads`
    return (
      <li key={dispute.id} className="dispute-row">
        <strong className="dispute-row-title">{disputeTitle(dispute.createdAt)}</strong>
        <div className="dispute-row-actions">
          <span className={`badge ${dispute.resolved ? 'done' : 'pending'}`}>
            {dispute.resolved ? 'resolved' : 'open'}
          </span>
          {dispute.resolved ? (
            <IconButton label={`View threads and resolution, ${threadLabel}`} onClick={() => openDispute(dispute, 'chat')}>
              <IconView />
            </IconButton>
          ) : (
            <>
              <IconButton label={`Threads, ${threadLabel}`} variant="primary" onClick={() => openDispute(dispute, 'chat')}>
                <IconComment />
              </IconButton>
              <button
                type="button"
                className="dispute-resolve-icon"
                aria-label="Edit description or resolve dispute"
                title="Edit description or resolve dispute"
                onClick={() => openDispute(dispute, 'manage')}
              >
                <IconResolve />
              </button>
            </>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card modal-card-wide modal-card-sheet dispute-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dispute-topbar">
          {focused ? (
            <button type="button" className="dispute-back" onClick={() => { setFocusId(null); setView(null); setThreadOpen(false) }}>
              <IconChevron /> Back to Disputes
            </button>
          ) : (
            <h2 id="dispute-title" className="dispute-topbar-title">Disputes</h2>
          )}
          <button type="button" className="dispute-x" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>
        <div className="dispute-body">
        {focused ? (
          <>
            <div className="dispute-summary">
              <div className="dispute-summary-icon" aria-hidden="true">
                <IconImage />
                <span className="dispute-alert">!</span>
              </div>
              <div className="dispute-summary-copy">
                <div className="dispute-summary-title">
                  <h2 id="dispute-title">{disputeTitle(focused.createdAt)}</h2>
                  <span className={`dispute-pill ${focused.resolved ? 'done' : 'open'}`}>
                    {focused.resolved ? 'Resolved' : 'Open'}
                  </span>
                </div>
                <p className="dispute-description">{focused.description || 'No description'}</p>
                <p className="dispute-summary-note">
                  {view === 'manage'
                    ? 'An admin code is required to edit the description or resolve this dispute.'
                    : focused.resolved
                      ? 'This dispute has been resolved.'
                      : 'Therapists can add proof or notes in the thread below.'}
                </p>
              </div>
            </div>

            {view === 'manage' && !focused.resolved ? (
              <>
                <section className="dispute-panel">
                  <h3 className="dispute-panel-head"><IconDoc /> Edit description</h3>
                  <div className="dispute-panel-body">
                    <label>
                      <span className="dispute-label"><IconPerson /> Admin code <em>*</em></span>
                      <span className="dispute-input">
                        <IconKey />
                        <input
                          type="password"
                          autoComplete="off"
                          value={adminCode}
                          onChange={(event) => setAdminCode(event.target.value)}
                          placeholder="Enter admin code"
                        />
                      </span>
                    </label>
                    <label>
                      <span className="dispute-label"><IconDoc /> Description <em>*</em></span>
                      <textarea
                        value={drafts[`description-${focused.id}`] ?? focused.description}
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [`description-${focused.id}`]: event.target.value,
                        }))}
                        required
                      />
                    </label>
                    <div className="dispute-save-row">
                      <button type="button" className="dispute-outline" disabled={busy} onClick={() => saveDescription(focused)}>
                        <IconSave /> Save description
                      </button>
                    </div>
                  </div>
                </section>
                <section className="dispute-panel">
                  <h3 className="dispute-panel-head"><IconResolve /> Resolve dispute</h3>
                  <div className="dispute-panel-body">
                    <label>
                      <span className="dispute-label"><IconKey /> Admin code <em>*</em></span>
                      <input
                        type="password"
                        autoComplete="off"
                        value={adminCode}
                        onChange={(event) => setAdminCode(event.target.value)}
                        placeholder="Enter admin code"
                        required
                      />
                    </label>
                    <label>
                      <span className="dispute-label">Resolution</span>
                      <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} />
                    </label>
                    <label>
                      <span className="dispute-label">Resolution images</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => setResolutionImages(Array.from(event.target.files || []))}
                      />
                    </label>
                    <button type="button" className="btn small primary" disabled={busy} onClick={() => resolve(focused)}>
                      Resolve
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <section className="dispute-panel">
                <div className="dispute-panel-head dispute-panel-head-split">
                  <h3><IconComment /> Threads</h3>
                  <p className="dispute-hint" title="Any therapist can reply here, including therapists who are not assigned to this session.">
                    <span className="dispute-hint-icon" aria-hidden="true">i</span>
                    <span className="dispute-hint-text">Any therapist can reply here, including therapists who are not assigned to this session.</span>
                  </p>
                </div>
                <div className="dispute-panel-body">
                  {focused.resolved ? (
                    <div className="dispute-resolution-note">
                      <strong>Resolution</strong>
                      {focused.resolution?.text ? <p>{focused.resolution.text}</p> : <p className="muted">No resolution text.</p>}
                      {focused.resolution?.imageUrls?.length ? (
                        <div className="payment-methods-list">
                          {focused.resolution.imageUrls.map((url) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt="" className="receipt-thumb" />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <ThreadList
                    dispute={focused}
                    emptyHint={focused.resolved ? 'No threads were added.' : undefined}
                  />
                  {focused.resolved ? null : (
                    <>
                      <button
                        type="button"
                        className="dispute-add-toggle"
                        aria-expanded={threadOpen}
                        aria-label={threadOpen ? 'Close add thread' : 'Add thread'}
                        onClick={() => setThreadOpen((open) => !open)}
                      >
                        {threadOpen ? 'Close' : 'Add thread'}
                      </button>
                      {threadOpen ? (
                        <form onSubmit={(event) => addThread(focused, event)} className="dispute-composer dispute-thread-grid">
                          <label>
                            <span className="dispute-label">Name <em>*</em></span>
                            <input
                              value={composer(focused.id).name}
                              onChange={(event) => patchComposer(focused.id, { name: event.target.value })}
                              placeholder="Enter your name"
                              required
                            />
                          </label>
                          <label>
                            <span className="dispute-label">Therapist Code <em>*</em></span>
                            <input
                              value={composer(focused.id).th}
                              onChange={(event) => patchComposer(focused.id, { th: event.target.value })}
                              placeholder="Enter therapist's code"
                              required
                            />
                          </label>
                          <label>
                            <span className="dispute-label">Message <em>*</em></span>
                            <textarea
                              value={composer(focused.id).text}
                              onChange={(event) => patchComposer(focused.id, { text: event.target.value })}
                              placeholder="Type your message here..."
                              required
                            />
                          </label>
                          <label>
                            <span className="dispute-label"><IconImage /> Attach Image (Proof of Payment)</span>
                            <span className="dispute-file">
                              <input
                                key={composer(focused.id).imageKey || 0}
                                type="file"
                                accept="image/jpeg,image/png"
                                onChange={(event) => pickThreadImage(focused.id, event.target.files?.[0] || null)}
                              />
                              <span className="dispute-file-btn">Choose File</span>
                              <span className="dispute-file-name">
                                {composer(focused.id).image?.name || 'No file chosen'}
                              </span>
                              <span className="dispute-file-hint">Supported formats: JPG, PNG, JPEG (Max: 5 MB)</span>
                            </span>
                          </label>
                          <button type="submit" className="dispute-submit" disabled={busy}>
                            <IconSend /> {busy ? 'Adding…' : 'Post thread'}
                          </button>
                        </form>
                      ) : null}
                    </>
                  )}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <section>
              <h3 className="dispute-section-title">Open</h3>
              {openDisputes.length === 0 ? (
                <p className="muted">No open disputes.</p>
              ) : (
                <ul className="dispute-list">{openDisputes.map(renderRow)}</ul>
              )}
            </section>
            <section>
              <h3 className="dispute-section-title">Resolved</h3>
              {resolvedDisputes.length === 0 ? (
                <p className="muted">No resolved disputes.</p>
              ) : (
                <ul className="dispute-list">{resolvedDisputes.map(renderRow)}</ul>
              )}
            </section>
            <div className="dispute-add">
              <button
                type="button"
                className={`dispute-add-btn${addOpen ? ' open' : ''}`}
                aria-expanded={addOpen}
                aria-label={addOpen ? 'Close add dispute' : 'Add dispute'}
                onClick={() => setAddOpen((open) => !open)}
              >
                <span className="dispute-add-plus" aria-hidden="true">{addOpen ? '×' : '+'}</span>
                {addOpen ? 'Close' : 'Add dispute'}
              </button>
              {addOpen ? (
                <form onSubmit={raise} className="dispute-add-form">
                  <label>
                    <span className="dispute-label">Admin code</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={adminCode}
                      onChange={(event) => setAdminCode(event.target.value)}
                      placeholder="Required to add a description"
                    />
                  </label>
                  <label>
                    <span className="dispute-label">Description</span>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="What is in dispute"
                      required
                    />
                  </label>
                  <button type="submit" className="dispute-submit" disabled={busy}>
                    {busy ? 'Adding…' : 'Add description'}
                  </button>
                </form>
              ) : null}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}
