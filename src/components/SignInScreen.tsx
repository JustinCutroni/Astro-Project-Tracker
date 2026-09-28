import { useState } from 'react'
import { signInWithGoogle, signInWithTestAccount, useRedirectSignInError } from '../firebase/auth'

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'

export function SignInScreen() {
  const redirectError = useRedirectSignInError()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [testEmail, setTestEmail] = useState('test@example.com')

  async function handleSignIn() {
    setError(null)
    setPending(true)
    try {
      await signInWithGoogle()
    } catch {
      setError('Sign-in failed. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function handleTestSignIn() {
    setError(null)
    setPending(true)
    try {
      await signInWithTestAccount(testEmail, 'test-password-123')
    } catch {
      setError('Test sign-in failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="signin-screen">
      <h1>Astro Project Tracker</h1>
      <p className="muted">
        Sign in with Google to sync your projects across your devices - this only happens once
        per device.
      </p>
      <button className="btn btn-primary" onClick={handleSignIn} disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {(error || redirectError) && <p className="muted">{error || redirectError}</p>}

      {useEmulator && (
        <div className="card" style={{ marginTop: '2rem', textAlign: 'left' }}>
          <div className="muted" style={{ marginBottom: '0.5rem' }}>
            Emulator test sign-in (local dev only)
          </div>
          <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginTop: '0.5rem' }}
            onClick={handleTestSignIn}
          >
            Sign in as test user
          </button>
        </div>
      )}
    </div>
  )
}
