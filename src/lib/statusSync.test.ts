import { describe, expect, it, vi } from 'vitest'
import { cascadeStatus, earliestStatus, statusRank } from './statusSync'
import type { Status } from '../types/models'

// The pure status rules live in the same file as the database writes; stub
// the database module so these tests never start Firebase.
vi.mock('../firebase/firestoreDb', () => ({}))

const batch = (status: Status) => ({ status, updatedAt: '2020-01-01T00:00:00.000Z' })

describe('earliestStatus', () => {
  it('returns undefined when there are no items', () => {
    expect(earliestStatus([])).toBeUndefined()
  })

  it('returns the least-advanced status', () => {
    expect(earliestStatus([batch('processing'), batch('capturing'), batch('complete')])).toBe('capturing')
  })
})

describe('statusRank', () => {
  it('orders the pipeline Planning -> Complete', () => {
    const order: Status[] = ['planning', 'capturing', 'transferring', 'processing', 'complete']
    expect(order.map(statusRank)).toEqual([0, 1, 2, 3, 4])
  })
})

describe('cascadeStatus', () => {
  it('moving forward lifts batches that are behind and leaves ones already ahead', () => {
    const batches = [batch('planning'), batch('capturing'), batch('processing')]
    const changed = cascadeStatus(batches, 'planning', 'transferring')
    expect(changed.map((c) => c.status)).toEqual(['transferring', 'transferring'])
  })

  it('moving backward pulls back batches that are further along', () => {
    const batches = [batch('planning'), batch('capturing'), batch('processing')]
    const changed = cascadeStatus(batches, 'complete', 'capturing')
    expect(changed).toHaveLength(1)
    expect(changed[0].status).toBe('capturing')
  })

  it('returns nothing to change when every batch is already in place', () => {
    expect(cascadeStatus([batch('transferring')], 'capturing', 'transferring')).toEqual([])
    expect(cascadeStatus([], 'planning', 'complete')).toEqual([])
  })

  it('stamps a new updatedAt and does not mutate the input', () => {
    const original = batch('planning')
    const [changed] = cascadeStatus([original], 'planning', 'capturing')
    expect(original.status).toBe('planning')
    expect(changed.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
  })
})
