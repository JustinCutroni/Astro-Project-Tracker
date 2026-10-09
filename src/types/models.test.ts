import { describe, expect, it } from 'vitest'
import {
  integrationMinutesForFrames,
  plannedIntegrationMinutesForFrames,
  type Frame,
  type FrameType,
  type Status,
} from './models'

function frame(frameType: FrameType, status: Status, count: number, exposureSeconds: number): Frame {
  return {
    id: 'f',
    sessionId: 's',
    projectId: 'p',
    frameType,
    count,
    exposureSeconds,
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('integration time', () => {
  it('is zero with no frames', () => {
    expect(integrationMinutesForFrames([])).toBe(0)
    expect(plannedIntegrationMinutesForFrames([])).toBe(0)
  })

  it('totals Light frames in minutes', () => {
    const frames = [frame('light', 'capturing', 10, 180), frame('light', 'complete', 20, 60)]
    expect(integrationMinutesForFrames(frames)).toBe(50)
  })

  it('never counts darks, flats, flat darks or bias', () => {
    const frames = [
      frame('light', 'capturing', 10, 60),
      frame('dark', 'capturing', 50, 60),
      frame('flat', 'capturing', 50, 1),
      frame('flat-dark', 'capturing', 50, 1),
      frame('bias', 'capturing', 50, 0),
    ]
    expect(integrationMinutesForFrames(frames)).toBe(10)
    expect(plannedIntegrationMinutesForFrames(frames)).toBe(10)
  })

  it('skips batches still in Planning for captured time, but includes them in the plan', () => {
    const frames = [frame('light', 'planning', 30, 60), frame('light', 'capturing', 10, 60)]
    expect(integrationMinutesForFrames(frames)).toBe(10)
    expect(plannedIntegrationMinutesForFrames(frames)).toBe(40)
  })

  it('handles zero counts, zero exposures and very large totals', () => {
    expect(integrationMinutesForFrames([frame('light', 'complete', 0, 300)])).toBe(0)
    expect(integrationMinutesForFrames([frame('light', 'complete', 100, 0)])).toBe(0)
    expect(integrationMinutesForFrames([frame('light', 'complete', 1_000_000, 600)])).toBe(10_000_000)
  })
})
