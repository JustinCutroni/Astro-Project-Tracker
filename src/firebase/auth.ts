import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from './config'

const provider = new GoogleAuthProvider()

// These error codes mean the popup window itself couldn't complete the OAuth
// round-trip (blocked, auto-closed, or unsupported) rather than the user
// deciding not to sign in. Mobile Safari and installed PWAs hit these
// constantly - they can't reliably keep a popup window alive long enough.
// Redirect (a full-page navigation instead of a popup) works everywhere
// popups don't, so fall back to it automatically instead of surfacing an error.
const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
])

export async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, provider)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code && POPUP_FALLBACK_CODES.has(code)) {
      await signInWithRedirect(auth, provider)
      return
    }
    throw err
  }
}

// After signInWithRedirect, the browser navigates away and back - there's no
// caller left awaiting a promise the way there is with the popup flow, so any
// error from completing that redirect (e.g. an unauthorized domain) has to be
// picked up here instead, once, after the page reloads.
export function useRedirectSignInError(): string | null {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.error('Redirect sign-in failed:', err)
      setError('Sign-in failed. Please try again.')
    })
  }, [])

  return error
}

// Emulator-only: real Google OAuth needs live network access to Google's
// servers, which a local emulator (and some sandboxed test environments)
// can't reach. This path never runs against production - see the
// VITE_USE_FIREBASE_EMULATOR gate in SignInScreen.
export async function signInWithTestAccount(email: string, password: string) {
  try {
    await signInWithEmailAndPassword(auth, email, password)
  } catch {
    await createUserWithEmailAndPassword(auth, email, password)
  }
}

export function signOutUser() {
  return signOut(auth)
}

export function useAuthUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
