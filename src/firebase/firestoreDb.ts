import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  setDoc,
  where as fbWhere,
  writeBatch,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { auth, firestore } from './config'

export type CollectionName =
  | 'projects'
  | 'sessions'
  | 'frames'
  | 'cameras'
  | 'telescopes'
  | 'mounts'
  | 'filters'
  | 'locations'

function requireUid(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not signed in')
  return uid
}

function colRef(name: CollectionName) {
  return collection(firestore, 'users', requireUid(), name)
}

// Firestore's setDoc throws at runtime on any field whose value is
// `undefined` (unlike IndexedDB/Dexie, which tolerated it fine) - and this
// app builds records with `field: x || undefined` throughout. Stripping
// those keys here, once, means every call site doesn't have to know about it.
function stripUndefined<T extends object>(obj: T): T {
  const result = {} as T
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const value = obj[key]
    if (value === undefined) continue
    // Nested plain objects (e.g. a session's gear snapshot) need the same
    // treatment; arrays and class instances (Timestamps etc.) pass through.
    const isPlainObject = typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
    result[key] = isPlainObject ? stripUndefined(value as object) as T[keyof T] : value
  }
  return result
}

// --- Live (realtime) reads, for use in components ---

interface CollectionFilter<T> {
  field: keyof T & string
  value: string | undefined
}

export function useCollection<T extends { id: string }>(
  name: CollectionName,
  filter?: CollectionFilter<T>,
): T[] | undefined {
  const [data, setData] = useState<T[] | undefined>(undefined)
  const filterValue = filter?.value

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setData(undefined)
      return
    }
    // Mirrors the old "id ? query : []" pattern: a filter with no value yet
    // (e.g. a route param not resolved) means "nothing to show", not "still loading".
    if (filter && filterValue === undefined) {
      setData([])
      return
    }
    const base = collection(firestore, 'users', uid, name)
    const q = filter ? query(base, fbWhere(filter.field, '==', filterValue)) : base
    const unsubscribe = onSnapshot(
      q,
      (snap) => setData(snap.docs.map((d) => d.data() as T)),
      (err) => console.error(`useCollection(${name}) failed:`, err),
    )
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, filter?.field, filterValue])

  return data
}

export function useDocument<T extends { id: string }>(
  name: CollectionName,
  id: string | undefined,
): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid || !id) {
      setData(undefined)
      return
    }
    const ref = doc(firestore, 'users', uid, name, id)
    const unsubscribe = onSnapshot(
      ref,
      (snap) => setData(snap.exists() ? (snap.data() as T) : undefined),
      (err) => console.error(`useDocument(${name}/${id}) failed:`, err),
    )
    return unsubscribe
  }, [name, id])

  return data
}

// --- One-time reads and writes ---

export async function getAll<T>(name: CollectionName): Promise<T[]> {
  const snap = await getDocs(colRef(name))
  return snap.docs.map((d) => d.data() as T)
}

// Authoritative read for one-time migrations: bypasses the local cache, which
// can be partial, and throws while offline so the caller can simply retry on
// the next launch instead of acting on incomplete data.
export async function getAllFromServer<T>(name: CollectionName): Promise<T[]> {
  const snap = await getDocsFromServer(colRef(name))
  return snap.docs.map((d) => d.data() as T)
}

export async function getWhere<T>(
  name: CollectionName,
  field: keyof T & string,
  value: string,
): Promise<T[]> {
  const snap = await getDocs(query(colRef(name), fbWhere(field, '==', value)))
  return snap.docs.map((d) => d.data() as T)
}

// Firestore write promises (setDoc/deleteDoc/batch.commit) only resolve once
// the server acknowledges them - they do NOT resolve on the local optimistic
// write. While offline that means the promise simply never settles, so any
// caller that awaits it before navigating or clearing a form hangs forever.
// The local cache and any onSnapshot listeners are updated immediately
// regardless, so the fix is to not await the network round-trip here: log a
// failure if one eventually happens, but don't make callers wait for it.
function fireAndForget(promise: Promise<unknown>, label: string): Promise<void> {
  promise.catch((err) => console.error(`${label} failed:`, err))
  return Promise.resolve()
}

export async function putDoc<T extends { id: string }>(
  name: CollectionName,
  item: T,
): Promise<void> {
  return fireAndForget(setDoc(doc(colRef(name), item.id), stripUndefined(item)), `putDoc(${name})`)
}

export async function removeDoc(name: CollectionName, id: string): Promise<void> {
  return fireAndForget(deleteDoc(doc(colRef(name), id)), `removeDoc(${name})`)
}

export async function bulkPut<T extends { id: string }>(
  name: CollectionName,
  items: T[],
): Promise<void> {
  const batch = writeBatch(firestore)
  for (const item of items) batch.set(doc(colRef(name), item.id), stripUndefined(item))
  return fireAndForget(batch.commit(), `bulkPut(${name})`)
}

// Merges just the given fields into existing documents (leaving every other
// field alone, unlike putDoc which replaces the whole document), in batches
// under Firestore's 500-writes-per-batch limit.
export async function bulkMerge(
  name: CollectionName,
  items: ({ id: string } & Record<string, unknown>)[],
): Promise<void> {
  const BATCH_SIZE = 400
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore)
    for (const item of items.slice(i, i + BATCH_SIZE)) {
      batch.set(doc(colRef(name), item.id), stripUndefined(item), { merge: true })
    }
    await fireAndForget(batch.commit(), `bulkMerge(${name})`)
  }
}

export async function bulkRemove(name: CollectionName, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const batch = writeBatch(firestore)
  for (const id of ids) batch.delete(doc(colRef(name), id))
  return fireAndForget(batch.commit(), `bulkRemove(${name})`)
}

export async function removeWhere<T extends { id: string }>(
  name: CollectionName,
  field: keyof T & string,
  value: string,
): Promise<void> {
  const items = await getWhere<T>(name, field, value)
  await bulkRemove(
    name,
    items.map((i) => i.id),
  )
}

// Seeds default filters once, the first time the app runs with an empty
// filters collection. Deterministic IDs make this idempotent even if called
// more than once concurrently (e.g. across two tabs at first sign-in).
export async function seedDefaultFiltersIfEmpty(): Promise<void> {
  const existing = await getDocs(colRef('filters'))
  if (!existing.empty) return

  const defaults = ['L', 'R', 'G', 'B', 'S', 'Ha', 'OIII', 'L-Enhance', 'L-Extreme', 'Dark', 'None']
  const batch = writeBatch(firestore)
  const now = new Date().toISOString()
  for (const description of defaults) {
    const id = `default-${description.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    batch.set(doc(colRef('filters'), id), { id, description, dateAdded: now })
  }
  return fireAndForget(batch.commit(), 'seedDefaultFiltersIfEmpty')
}
