export default function Avatar({ person, size = 28, className = '' }) {
  if (!person) return null

  if (person.type === 'more') {
    return (
      <span className={`avatar avatar-more ${className}`} style={{ width: size, height: size, fontSize: size * 0.35 }}>
        {person.text}
      </span>
    )
  }

  if (person.type === 'initials') {
    return (
      <span
        className={`avatar avatar-initials ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.36,
          background: person.bg,
          color: person.color,
        }}
      >
        {person.text}
      </span>
    )
  }

  return (
    <img
      className={`avatar ${className}`}
      src={person.src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  )
}

export function AvatarStack({ people = [], size = 28 }) {
  return (
    <div className="avatar-stack">
      {people.map((p, i) => (
        <Avatar key={i} person={p} size={size} />
      ))}
    </div>
  )
}
