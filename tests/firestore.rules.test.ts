import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-astro-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/alice/projects/p1'), { name: 'Alice project' })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('firestore.rules', () => {
  it('lets a signed-in user read and write their own data', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertSucceeds(getDoc(doc(db, 'users/alice/projects/p1')))
    await assertSucceeds(setDoc(doc(db, 'users/alice/sessions/s1'), { projectId: 'p1' }))
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/sessions/s1')))
  })

  it("blocks a signed-in user from reading or writing someone else's data", async () => {
    const db = env.authenticatedContext('bob').firestore()
    await assertFails(getDoc(doc(db, 'users/alice/projects/p1')))
    await assertFails(setDoc(doc(db, 'users/alice/projects/p1'), { name: 'Hijacked' }))
    await assertFails(deleteDoc(doc(db, 'users/alice/projects/p1')))
  })

  it('blocks signed-out visitors from reading or writing anything', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'users/alice/projects/p1')))
    await assertFails(setDoc(doc(db, 'users/alice/projects/p2'), { name: 'Anonymous' }))
  })

  it('blocks everything outside users/{uid}, even when signed in', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertFails(getDoc(doc(db, 'public/readme')))
    await assertFails(setDoc(doc(db, 'projects/p1'), { name: 'Top-level' }))
  })
})
