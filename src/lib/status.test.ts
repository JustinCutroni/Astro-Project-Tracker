import { describe, expect, it } from 'vitest'
import { pipelineProgress } from './status'
import type { Frame, FrameType, Status } from '../types/models'

function frame(frameType: FrameType, status: Status, count = 10, exposureSeconds = 60): Frame {
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

describe('pipelineProgress', () => {
  it('falls back to the project status when there are no light batches', () => {
    expect(pipelineProgress({ status: 'planning' }, [])).toBe(0)
    expect(pipelineProgress({ status: 'processing' }, [])).toBe(75)
    expect(pipelineProgress({ status: 'complete' }, [])).toBe(100)
  })

  it('weights light batches by exposure time', () => {
    const frames = [frame('light', 'complete', 10, 60), frame('light', 'planning', 10, 60)]
    expect(pipelineProgress({ status: 'planning' }, frames)).toBe(50)
  })

  it('ignores calibration frames', () => {
    const frames = [frame('light', 'planning'), frame('dark', 'complete', 1000, 600)]
    expect(pipelineProgress({ status: 'planning' }, frames)).toBe(0)
  })

  it('never reports less than the project status', () => {
    expect(pipelineProgress({ status: 'processing' }, [frame('light', 'planning')])).toBe(75)
  })
})
