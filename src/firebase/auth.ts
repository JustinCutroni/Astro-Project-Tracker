import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from './config'

const provider = new GoogleAuthProvider()

export function signInWithGoogle() {
  return signInWithPopup(auth, provider)
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
