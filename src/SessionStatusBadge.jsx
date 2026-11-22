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

export default function SessionStatusBadge({ status, className = '', style }) {
  const key = String(status || '').toLowerCase()
  const disputed = key === 'disputed'
  const tone = disputed
    ? 'disputed'
    : key === 'completed'
      ? 'completed'
      : key === 'settled' || key === 'ended'
        ? 'done'
        : 'pending'
  return (
    <span className={`badge ${tone}${className ? ` ${className}` : ''}`} style={style}>
      {disputed ? <DisputeWarn /> : null}
      {status || '—'}
    </span>
  )
}
