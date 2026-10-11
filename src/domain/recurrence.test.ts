import { describe, expect, it } from 'vitest'
import { occursOn, stopRecurrence, todosForDate } from './recurrence'
import type { Todo } from './types'

const base = {
  date: '2026-01-31',
  recurrence: 'monthly' as const,
  completed: false,
  completedDates: ['2026-02-28'],
  endedAt: undefined,
}

describe('todo recurrence', () => {
  it('does not create occurrences before the start date', () => {
    expect(occursOn({ date: '2026-01-10', recurrence: 'daily' }, '2026-01-09')).toBe(false)
  })

  it('creates daily occurrences from the start date onward', () => {
    expect(occursOn({ date: '2026-01-10', recurrence: 'daily' }, '2026-01-10')).toBe(true)
    expect(occursOn({ date: '2026-01-10', recurrence: 'daily' }, '2026-01-12')).toBe(true)
  })

  it('matches the start weekday for weekly recurrence', () => {
    expect(occursOn({ date: '2026-01-05', recurrence: 'weekly' }, '2026-01-12')).toBe(true)
    expect(occursOn({ date: '2026-01-05', recurrence: 'weekly' }, '2026-01-13')).toBe(false)
  })

  it('clamps monthly dates to the last valid day in short months', () => {
    expect(occursOn(base, '2026-02-28')).toBe(true)
    expect(occursOn(base, '2026-03-31')).toBe(true)
    expect(occursOn(base, '2026-03-30')).toBe(false)
  })

  it('stops after the configured end date', () => {
    expect(occursOn({ date: '2026-01-01', recurrence: 'daily', endedAt: '2026-01-03' }, '2026-01-03')).toBe(true)
    expect(occursOn({ date: '2026-01-01', recurrence: 'daily', endedAt: '2026-01-03' }, '2026-01-04')).toBe(false)
  })

  it('tracks completion for a recurring occurrence independently', () => {
    const todo = { ...base, id: 'a' } as Todo
    expect(todosForDate([todo], '2026-02-28')[0]?.completed).toBe(true)
    expect(todosForDate([todo], '2026-03-31')[0]?.completed).toBe(false)
  })

  it('uses the original date for a non-repeating task', () => {
    expect(occursOn({ date: '2026-04-02', recurrence: 'none' }, '2026-04-02')).toBe(true)
    expect(occursOn({ date: '2026-04-02', recurrence: 'none' }, '2026-04-03')).toBe(false)
  })

  it('does not leave a future occurrence when a rule is stopped before its start', () => {
    const stopped = stopRecurrence({ ...base, id: 'future', title: 'future', note: '', createdAt: '', updatedAt: '', date: '2026-10-20', recurrence: 'daily', completed: false, completedDates: [] } as Todo, '2026-10-12')
    expect(stopped.endedAt).toBe('2026-10-11')
    expect(occursOn(stopped, '2026-10-20')).toBe(false)
  })
})
