export function DisputeWarn() {
  return (
    <svg className="dispute-warn" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.4 1.4 21.2h21.2L12 2.4Z"
        fill="#fbbf24"
        stroke="#9a3412"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 9.1v5" stroke="#7c2d12" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="17.3" r="1.15" fill="#7c2d12" />
    </svg>
  )
}

function statusLabel(status) {
  const text = String(status || '').trim()
  if (!text) return '—'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function StatusMark({ kind }) {
  if (kind === 'done') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.16" />
        <path d="M8 12.2 10.7 15 16.2 9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'started') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="#ffedd5" />
        <path d="M10 8.2v7.6l6.2-3.8L10 8.2Z" fill="currentColor" />
      </svg>
    )
  }
  return null
}

export default function SessionStatusBadge({ status, className = '', style }) {
  const key = String(status || '').toLowerCase()
  const disputed = key === 'disputed'
  const tone = disputed
    ? 'disputed'
    : key === 'completed'
      ? 'completed'
      : key === 'started'
        ? 'started'
        : key === 'settled' || key === 'ended'
          ? 'done'
          : 'pending'
  const mark = tone === 'done' ? 'done' : tone === 'started' ? 'started' : ''
  return (
    <span className={`badge ${tone}${className ? ` ${className}` : ''}`} style={style}>
      {disputed ? <DisputeWarn /> : <StatusMark kind={mark} />}
      {statusLabel(status)}
    </span>
  )
}
