import { describe, expect, it } from 'vitest'
import type { AppStatus } from '@shared/events'
import {
  TRANSITIONS,
  canStartSession,
  canStopSession,
  isAllowedTransition
} from '../transitions'

const ALL_STATES: AppStatus[] = [
  'idle',
  'listening',
  'transcribing',
  'pasting',
  'done',
  'error'
]

describe('TRANSITIONS table', () => {
  it('lists every AppStatus as a key', () => {
    for (const s of ALL_STATES) {
      expect(TRANSITIONS).toHaveProperty(s)
    }
  })

  it('only points to known AppStatus values', () => {
    for (const from of ALL_STATES) {
      for (const to of TRANSITIONS[from]) {
        expect(ALL_STATES).toContain(to)
      }
    }
  })
})

describe('isAllowedTransition', () => {
  it('allows the same-state no-op transition for every state', () => {
    for (const s of ALL_STATES) {
      expect(isAllowedTransition(s, s)).toBe(true)
    }
  })

  it('allows the happy path: idle → listening → transcribing → pasting → done → idle', () => {
    expect(isAllowedTransition('idle', 'listening')).toBe(true)
    expect(isAllowedTransition('listening', 'transcribing')).toBe(true)
    expect(isAllowedTransition('transcribing', 'pasting')).toBe(true)
    expect(isAllowedTransition('pasting', 'done')).toBe(true)
    expect(isAllowedTransition('done', 'idle')).toBe(true)
  })

  it('allows the no-transcript branch: transcribing → done', () => {
    expect(isAllowedTransition('transcribing', 'done')).toBe(true)
  })

  it('allows error from idle, listening, transcribing, pasting, done', () => {
    expect(isAllowedTransition('idle', 'error')).toBe(true)
    expect(isAllowedTransition('listening', 'error')).toBe(true)
    expect(isAllowedTransition('transcribing', 'error')).toBe(true)
    expect(isAllowedTransition('pasting', 'error')).toBe(true)
    expect(isAllowedTransition('done', 'error')).toBe(true)
  })

  it('allows interrupting done / error with a new session (→ listening)', () => {
    expect(isAllowedTransition('done', 'listening')).toBe(true)
    expect(isAllowedTransition('error', 'listening')).toBe(true)
  })

  it('rejects skipping listening (idle → transcribing/pasting/done)', () => {
    expect(isAllowedTransition('idle', 'transcribing')).toBe(false)
    expect(isAllowedTransition('idle', 'pasting')).toBe(false)
    expect(isAllowedTransition('idle', 'done')).toBe(false)
  })

  it('rejects skipping transcribing (listening → pasting/done)', () => {
    expect(isAllowedTransition('listening', 'pasting')).toBe(false)
    expect(isAllowedTransition('listening', 'done')).toBe(false)
  })

  it('rejects going back to listening from transcribing or pasting', () => {
    expect(isAllowedTransition('transcribing', 'listening')).toBe(false)
    expect(isAllowedTransition('pasting', 'listening')).toBe(false)
  })

  it('rejects pasting → idle without passing through done', () => {
    expect(isAllowedTransition('pasting', 'idle')).toBe(false)
  })
})

describe('canStartSession', () => {
  it('allows starting from idle, done, error', () => {
    expect(canStartSession('idle')).toBe(true)
    expect(canStartSession('done')).toBe(true)
    expect(canStartSession('error')).toBe(true)
  })

  it('rejects starting from listening, transcribing, pasting', () => {
    expect(canStartSession('listening')).toBe(false)
    expect(canStartSession('transcribing')).toBe(false)
    expect(canStartSession('pasting')).toBe(false)
  })
})

describe('canStopSession', () => {
  it('allows stopping from listening and transcribing only', () => {
    expect(canStopSession('listening')).toBe(true)
    expect(canStopSession('transcribing')).toBe(true)
  })

  it('rejects stopping from any other state', () => {
    expect(canStopSession('idle')).toBe(false)
    expect(canStopSession('pasting')).toBe(false)
    expect(canStopSession('done')).toBe(false)
    expect(canStopSession('error')).toBe(false)
  })
})
