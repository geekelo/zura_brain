import { pinnedNotes, allNotes } from '../data'
import { AvatarStack } from '../components/Avatar'
import {
  IconFolder,
  IconShare,
  IconMore,
  IconPin,
  IconChevron,
  IconGrid,
  IconList,
  IconCheckbox,
  IconPen,
  IconImage,
  LogoMark,
} from '../components/Icons'

function NoteCard({ note, pinned = false }) {
  return (
    <article className={`note-card ${note.tint ? `tint-${note.tint}` : ''}`}>
      <div className="note-card-top">
        <h3>{note.title}</h3>
        {pinned ? (
          <span className="pin">
            <IconPin />
          </span>
        ) : (
          <button type="button" className="icon-btn sm" aria-label="More">
            <IconMore />
          </button>
        )}
      </div>

      <div className="note-body">
        {note.type === 'text' && <p>{note.body}</p>}

        {note.type === 'bullets' && (
          <ul className="note-bullets">
            {note.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        {note.type === 'checklist' && (
          <ul className="note-checks">
            {note.items.map((item) => (
              <li key={item.text} className={item.done ? 'done' : ''}>
                <span className={`box ${item.done ? 'checked' : ''}`}>{item.done ? '✓' : ''}</span>
                {item.text}
              </li>
            ))}
          </ul>
        )}

        {note.type === 'swatches' && (
          <div className="swatches">
            {note.swatches.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </div>
        )}

        {note.type === 'logo' && (
          <div className="logo-preview">
            <LogoMark size={36} />
            <strong>TaskPlate</strong>
          </div>
        )}

        {note.type === 'moodboard' && (
          <div className="moodboard">
            {note.images.map((src) => (
              <img key={src} src={src} alt="" loading="lazy" />
            ))}
          </div>
        )}

        {note.type === 'type' && (
          <div className="type-samples">
            <div>
              <span className="aa inter">Aa</span>
              <em>Inter</em>
            </div>
            <div>
              <span className="aa satoshi">Aa</span>
              <em>Satoshi</em>
            </div>
          </div>
        )}
      </div>

      <div className="note-footer">
        <span className={`tag tint-${note.tagColor}`}>{note.tag}</span>
        <div className="note-meta">
          {note.members && <AvatarStack people={note.members} size={20} />}
          <span>{note.date}</span>
        </div>
      </div>
    </article>
  )
}

export default function NotesView({ onBack }) {
  return (
    <div className="page notes-page">
      <div className="breadcrumbs">
        <button type="button" onClick={onBack}>
          Projects
        </button>
        <span>/</span>
        <span className="crumb-current">
          <IconFolder size={14} color="#F2C94C" />
          Brand Refresh
        </span>
      </div>

      <div className="project-title-row">
        <div>
          <h1>Brand Refresh</h1>
          <p className="subtitle">24 notes · 18 tasks</p>
        </div>
        <div className="project-actions">
          <AvatarStack
            people={[
              { type: 'img', src: 'https://i.pravatar.cc/40?img=47' },
              { type: 'img', src: 'https://i.pravatar.cc/40?img=12' },
              { type: 'img', src: 'https://i.pravatar.cc/40?img=32' },
              { type: 'more', text: '+2' },
            ]}
            size={32}
          />
          <button type="button" className="btn-secondary">
            <IconShare />
            Share
          </button>
          <button type="button" className="icon-btn bordered" aria-label="More">
            <IconMore />
          </button>
        </div>
      </div>

      <div className="take-note">
        <input type="text" placeholder="Take a note..." />
        <div className="take-note-actions">
          <button type="button" aria-label="Checklist">
            <IconCheckbox />
          </button>
          <button type="button" aria-label="Draw">
            <IconPen />
          </button>
          <button type="button" aria-label="Image">
            <IconImage />
          </button>
        </div>
      </div>

      <section className="notes-section">
        <h2 className="section-label">PINNED NOTES</h2>
        <div className="notes-grid pinned">
          {pinnedNotes.map((n) => (
            <NoteCard key={n.id} note={n} pinned />
          ))}
        </div>
      </section>

      <section className="notes-section">
        <div className="section-toolbar">
          <h2 className="section-label">ALL NOTES</h2>
          <div className="toolbar-right">
            <button type="button" className="chip">
              Sort: Last edited <IconChevron />
            </button>
            <div className="view-toggle">
              <button type="button" className="active" aria-label="Grid view">
                <IconGrid />
              </button>
              <button type="button" aria-label="List view">
                <IconList />
              </button>
            </div>
          </div>
        </div>
        <div className="notes-grid">
          {allNotes.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </div>
      </section>
    </div>
  )
}
