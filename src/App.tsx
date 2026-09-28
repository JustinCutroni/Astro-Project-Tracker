import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { SignInScreen } from './components/SignInScreen'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { ProjectForm } from './pages/ProjectForm'
import { ProjectDetail } from './pages/ProjectDetail'
import { SessionForm } from './pages/SessionForm'
import { SessionDetail } from './pages/SessionDetail'
import { FrameForm } from './pages/FrameForm'
import { ImportSessionLog } from './pages/ImportSessionLog'
import { Settings } from './pages/Settings'
import { useAuthUser } from './firebase/auth'
import { seedDefaultFiltersIfEmpty } from './firebase/firestoreDb'

function App() {
  const { user, loading } = useAuthUser()

  useEffect(() => {
    if (user) seedDefaultFiltersIfEmpty()
  }, [user])

  if (loading) return null
  if (!user) return <SignInScreen />

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
          <Route path="/projects/:projectId/sessions/import" element={<ImportSessionLog />} />
          <Route path="/projects/:projectId/sessions/:sessionId" element={<SessionDetail />} />
          <Route
            path="/projects/:projectId/sessions/:sessionId/import"
            element={<ImportSessionLog />}
          />
          <Route
            path="/projects/:projectId/sessions/:sessionId/edit"
            element={<SessionForm />}
          />
          <Route
            path="/projects/:projectId/sessions/:sessionId/frames/new"
            element={<FrameForm />}
          />
          <Route
            path="/projects/:projectId/sessions/:sessionId/frames/:frameId"
            element={<FrameForm />}
          />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
