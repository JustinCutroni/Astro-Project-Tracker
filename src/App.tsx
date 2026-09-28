import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { ProjectForm } from './pages/ProjectForm'
import { ProjectDetail } from './pages/ProjectDetail'
import { SessionForm } from './pages/SessionForm'
import { Settings } from './pages/Settings'
import { seedDefaultsIfEmpty } from './db/db'

function App() {
  useEffect(() => {
    seedDefaultsIfEmpty()
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/new" element={<ProjectForm />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/edit" element={<ProjectForm />} />
          <Route path="/projects/:projectId/sessions/new" element={<SessionForm />} />
          <Route
            path="/projects/:projectId/sessions/:sessionId"
            element={<SessionForm />}
          />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
