import { useEffect, useState } from 'react'
import { sessionTherapistRoles } from './data'
import {
  listPosTherapists,
  addPosSessionTherapist,
  removePosSessionTherapist,
  tipPosSessionTherapist,
  normalizeSessionTherapist,
} from './api'

function formatMoney(n) {
  return `₦${Number(n || 0).toLocaleString()}`
}

function roleLabel(role) {
  const r = String(role || '').trim()
  if (!r) return ''
  return r.charAt(0).toUpperCase() + r.slice(1)
}

export default function SessionTherapists({ session, showToast, onClose, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [loadingRoster, setLoadingRoster] = useState(true)
  const [roster, setRoster] = useState([])
  /** { [workName]: role } */
  const [selected, setSelected] = useState({})
  const [creatorCode, setCreatorCode] = useState('')
  const [adminTipCode, setAdminTipCode] = useState('')
  /** { [workName]: tip amount string } */
  const [tipInputs, setTipInputs] = useState({})
  const assigned = Array.isArray(session.sessionTherapists) ? session.sessionTherapists : []
  const selectedKeys = Object.keys(selected)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingRoster(true)
      try {
        const result = await listPosTherapists({ active: true })
        if (cancelled) return
        if (!result.ok) {
          showToast(result.error)
          setRoster([])
          return
        }
        setRoster(result.therapists)
      } catch (err) {
        if (!cancelled) {
          showToast(err?.message || 'Could not load therapists')
          setRoster([])
        }
      } finally {
        if (!cancelled) setLoadingRoster(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function syncList(nextList) {
    const therapists = nextList
      .map((t) => {
        const name = t?.name ? String(t.name).trim() : ''
        if (!name) return ''
        const role = roleLabel(t.role)
        return role ? `${name} (${role})` : name
      })
      .filter(Boolean)
    onUpdated({
      ...session,
      sessionTherapists: nextList,
      therapists,
      therapistLabel: therapists.join(', '),
    })
  }

  function toggleTherapist(t) {
    const key = t.workName
    setSelected((prev) => {
      if (prev[key]) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: sessionTherapistRoles[0] }
    })
  }

  function setTherapistRole(workName, role) {
    setSelected((prev) => ({ ...prev, [workName]: role }))
  }

  function assignAuth() {
    const authCode = creatorCode.trim()
    if (!authCode) return null
    return /^\d+$/.test(authCode) ? { tc: authCode } : { th: authCode }
  }

  async function removeAssigned(name) {
    if (busy) return
    if (!session.sessionCode) {
      showToast('Session code required')
      return
    }
    const auth = assignAuth()
    if (!auth) {
      showToast('Enter creator or admin code to remove')
      return
    }
    setBusy(true)
    try {
      const result = await removePosSessionTherapist({
        ...auth,
        ss: session.sessionCode,
        name,
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      syncList(
        assigned.filter((x) => String(x.name).toLowerCase() !== String(name).toLowerCase()),
      )
      showToast(result.message || 'Therapist removed')
    } catch (err) {
      showToast(err?.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  async function submitTip(name) {
    if (busy) return
    if (!session.sessionCode) {
      showToast('Session code required')
      return
    }
    if (!adminTipCode.trim()) {
      showToast('Enter admin code to tip')
      return
    }
    const amount = Number(tipInputs[name])
    if (!(amount > 0)) {
      showToast('Tip amount must be greater than 0')
      return
    }
    setBusy(true)
    try {
      const admin = adminTipCode.trim()
      const result = await tipPosSessionTherapist({
        ss: session.sessionCode,
        name,
        tip_amount: amount,
        ...(/^\d+$/.test(admin) ? { tc: admin } : { admin_code: admin }),
      })
      if (!result.ok) {
        showToast(result.error)
        return
      }
      const tip = result.tip
      syncList(
        assigned.map((x) =>
          String(x.name).toLowerCase() === String(name).toLowerCase()
            ? {
                ...x,
                name: tip.name || x.name,
                tipAmount: tip.tipAmount,
                tipBalance: tip.tipBalance,
              }
            : x,
        ),
      )
      setTipInputs((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
      showToast(`Tipped ${tip.name || name}`)
    } catch (err) {
      showToast(err?.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  async function submitAssign(e) {
    e?.preventDefault()
    if (busy) return
    if (!session.sessionCode) {
      showToast('Session code required')
      return
    }
    if (!creatorCode.trim()) {
      showToast('Enter session creator or admin code')
      return
    }
    const picked = roster
      .filter((t) => selected[t.workName])
      .map((t) => ({ ...t, role: selected[t.workName] || sessionTherapistRoles[0] }))
    if (picked.length === 0) {
      showToast('Select at least one therapist')
      return
    }

    setBusy(true)
    let nextAssigned = [...assigned]
    let okCount = 0
    let lastError = ''
    const auth = assignAuth()

    try {
      for (const t of picked) {
        const result = await addPosSessionTherapist({
          ...auth,
          ss: session.sessionCode,
          name: t.workName,
          role: t.role,
        })
        if (!result.ok) {
          lastError = `${t.workName}: ${result.error}`
          showToast(lastError)
          continue
        }
        const row = normalizeSessionTherapist(result.sessionTherapist, {
          name: t.workName,
          role: t.role,
        })
        nextAssigned = [
          row,
          ...nextAssigned.filter(
            (x) => String(x.name).toLowerCase() !== String(t.workName).toLowerCase(),
          ),
        ]
        okCount += 1
        syncList(nextAssigned)
      }

      if (okCount > 0) {
        setSelected({})
        showToast(
          okCount === picked.length
            ? `Assigned ${okCount} therapist${okCount === 1 ? '' : 's'}`
            : `Assigned ${okCount} of ${picked.length}. ${lastError}`,
        )
      }
    } catch (err) {
      showToast(err?.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card panel-card session-actions assign-panel">
      <div className="panel-head">
        <h2>Assign therapists · {session.sessionCode || 'Session'}</h2>
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted note-intro">
        {[session.clientName || 'Client', session.clientPhone, session.sessionType, session.massageType]
          .filter(Boolean)
          .join(' · ')}
      </p>

      <section className="assign-section">
        <div className="assign-section-head">
          <h3>On this session</h3>
          <span className="muted">
            {assigned.length === 0
              ? 'None assigned yet'
              : `${assigned.length} therapist${assigned.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {assigned.length === 0 ? (
          <p className="muted assign-empty">Assign therapists below.</p>
        ) : (
          <>
            <label className="assign-admin-field">
              <span>Admin code for tips</span>
              <input
                type="password"
                autoComplete="off"
                value={adminTipCode}
                onChange={(e) => setAdminTipCode(e.target.value)}
                placeholder="Required to tip"
              />
            </label>

            <ul className="assigned-therapist-list">
              {assigned.map((t) => {
                const tipped = t.tipAmount != null && Number(t.tipAmount) > 0
                return (
                  <li key={t.name} className={tipped ? 'has-tip' : ''}>
                    <div className="assigned-therapist-top">
                      <div>
                        <strong className="assigned-name">{t.name}</strong>
                        {t.role ? (
                          <span className="assigned-role">{roleLabel(t.role)}</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="text-btn"
                        disabled={busy || !creatorCode.trim() || !session.sessionCode}
                        onClick={() => removeAssigned(t.name)}
                      >
                        Remove
                      </button>
                    </div>

                    {tipped ? (
                      <div className="assigned-tip-stats">
                        <div>
                          <span className="tip-stat-label">Tip</span>
                          <strong>{formatMoney(t.tipAmount)}</strong>
                        </div>
                        <div>
                          <span className="tip-stat-label">Balance</span>
                          <strong>
                            {t.tipBalance != null ? formatMoney(t.tipBalance) : '—'}
                          </strong>
                        </div>
                      </div>
                    ) : null}

                    <div className="assigned-tip-row">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="Tip amount"
                        value={tipInputs[t.name] || ''}
                        onChange={(e) =>
                          setTipInputs((prev) => ({ ...prev, [t.name]: e.target.value }))
                        }
                        disabled={busy}
                        aria-label={`Tip amount for ${t.name}`}
                      />
                      <button
                        type="button"
                        className="btn small primary"
                        disabled={
                          busy ||
                          !adminTipCode.trim() ||
                          !session.sessionCode ||
                          !(Number(tipInputs[t.name]) > 0)
                        }
                        onClick={() => submitTip(t.name)}
                      >
                        Tip
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <section className="assign-section">
        <div className="assign-section-head">
          <h3>Add therapists</h3>
        </div>

        <form className="session-form assign-add-form" onSubmit={submitAssign}>
          <label className="staff-code-field full">
            <span className="label-text">
              Creator or admin code <em>*</em>
            </span>
            <input
              type="password"
              autoComplete="off"
              value={creatorCode}
              onChange={(e) => setCreatorCode(e.target.value)}
              placeholder="code"
              required
            />
            <span className="field-hint">Required to assign or remove</span>
          </label>

          <div className="therapist-roster full">
            <div className="therapist-roster-head">
              <strong>Select therapists</strong>
              <button
                type="button"
                className="text-btn"
                disabled={loadingRoster || busy}
                onClick={() => {
                  setLoadingRoster(true)
                  listPosTherapists({ active: true })
                    .then((result) => {
                      if (!result.ok) {
                        showToast(result.error)
                        setRoster([])
                        return
                      }
                      setRoster(result.therapists)
                    })
                    .catch((err) => showToast(err?.message || 'Could not load therapists'))
                    .finally(() => setLoadingRoster(false))
                }}
              >
                Refresh
              </button>
            </div>
            {loadingRoster ? (
              <p className="muted">Loading therapists…</p>
            ) : roster.length === 0 ? (
              <p className="muted">No active therapists found.</p>
            ) : (
              <div className="therapist-pick-grid">
                {roster.map((t) => {
                  const active = Boolean(selected[t.workName])
                  return (
                    <button
                      key={t.workName}
                      type="button"
                      className={`therapist-pick ${active ? 'active' : ''}`}
                      onClick={() => toggleTherapist(t)}
                    >
                      {t.workName}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="field-hint">
              {selectedKeys.length
                ? `${selectedKeys.length} selected · set a role for each`
                : 'Tap to select multiple therapists'}
            </p>
          </div>

          {selectedKeys.length > 0 && (
            <ul className="therapist-role-list full">
              {selectedKeys.map((workName) => (
                <li key={workName}>
                  <strong>{workName}</strong>
                  <select
                    value={selected[workName]}
                    onChange={(e) => setTherapistRole(workName, e.target.value)}
                    aria-label={`Role for ${workName}`}
                  >
                    {sessionTherapistRoles.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}

          <div className="form-actions full">
            <button
              type="submit"
              className="btn primary"
              disabled={busy || selectedKeys.length === 0 || !creatorCode.trim()}
            >
              {busy
                ? 'Assigning…'
                : `Assign${selectedKeys.length ? ` (${selectedKeys.length})` : ''}`}
            </button>
          </div>
        </form>
      </section>
    </section>
  )
}
