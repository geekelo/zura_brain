import { useState } from 'react'
import { projects } from '../data'
import { AvatarStack } from '../components/Avatar'
import {
  IconFolder,
  IconMore,
  IconPlus,
  IconChevron,
  IconGrid,
  IconList,
} from '../components/Icons'

const folderColors = {
  yellow: '#F2C94C',
  purple: '#A78BFA',
  blue: '#60A5FA',
  green: '#4ADE80',
  red: '#F87171',
  teal: '#2DD4BF',
}

export default function ProjectsView({ onOpenProject }) {
  const [viewMode, setViewMode] = useState('grid')

  return (
    <div className="page projects-page">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="subtitle">Organize your work and life in one place.</p>
        </div>
        <button type="button" className="btn-primary">
          <IconPlus size={16} />
          New Project
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <button type="button" className="chip">
            All Projects <IconChevron />
          </button>
          <button type="button" className="chip">
            Sort: Recent <IconChevron />
          </button>
        </div>
        <div className="view-toggle">
          <button
            type="button"
            className={viewMode === 'grid' ? 'active' : ''}
            aria-label="Grid view"
            onClick={() => setViewMode('grid')}
          >
            <IconGrid />
          </button>
          <button
            type="button"
            className={viewMode === 'list' ? 'active' : ''}
            aria-label="List view"
            onClick={() => setViewMode('list')}
          >
            <IconList />
          </button>
        </div>
      </div>

      <div className={`project-grid ${viewMode}`}>
        {projects.map((p) => (
          <button
            type="button"
            key={p.id}
            className={`project-card tint-${p.color}`}
            onClick={() => onOpenProject(p.id)}
          >
            <div className="project-card-top">
              <IconFolder size={28} color={folderColors[p.color]} />
              <span className="more" onClick={(e) => e.stopPropagation()} role="presentation">
                <IconMore />
              </span>
            </div>
            <h3>{p.name}</h3>
            <p>
              {p.notes} notes · {p.tasks} tasks
            </p>
            <div className="project-card-footer">
              <AvatarStack people={p.members} size={26} />
              <span className="updated">{p.updated}</span>
            </div>
          </button>
        ))}
      </div>

      <button type="button" className="new-project-dropzone">
        <IconPlus size={18} />
        <strong>New Project</strong>
        <span>Create a new project to get started</span>
      </button>
    </div>
  )
}
