import { useLocation, useNavigate } from 'react-router-dom'

// React Router gives the first screen of a visit the key 'default'. Any other key means
// the user got here from another screen in the app, so stepping back stays inside the app.
export function hasPreviousScreen(locationKey: string): boolean {
  return locationKey !== 'default'
}

// Returns a function that goes back to the previous screen, or to `fallback` when this
// screen was opened directly (e.g. a fresh launch or a pasted link) and there is nowhere to go back to.
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()
  const { key } = useLocation()
  return () => {
    if (hasPreviousScreen(key)) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}
