import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import ProjectsView from './views/ProjectsView'
import RemindersView from './views/RemindersView'
import NotesView from './views/NotesView'
import { accounts } from './data'
import './App.css'

export default function App() {
  const [view, setView] = useState('projects')
  const user = accounts.find((a) => a.active)

  const openProject = () => setView('notes')

  return (
    <div className={`app ${view === 'reminders' ? 'with-rail' : ''}`}>
      <Sidebar
        view={view}
        onNavigate={setView}
        variant={view === 'notes' ? 'notes' : 'default'}
      />
      <div className="main">
        <TopBar user={user} />
        {view === 'projects' && <ProjectsView onOpenProject={openProject} />}
        {view === 'reminders' && <RemindersView />}
        {view === 'notes' && <NotesView onBack={() => setView('projects')} />}
      </div>
    </div>
  )
}
