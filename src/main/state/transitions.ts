import type { AppStatus } from '@shared/events'

/**
 * The legal transitions of the mini-window status state machine. Each key
 * lists the states that may follow it.
 *
 *   idle ──hotkey──► listening ──hotkey──► transcribing ──final──► pasting ──ok──► done ──delay──► idle
 *                                                              │                            │
 *                                                              └──no final──► done ◄────────┘
 *                                                                              │
 *   any ──error──► error ──delay──► idle / ──hotkey──► listening
 *   done ──hotkey──► listening   (interrupt the visual hold)
 *
 * `error` and `listening` are the most permissive: an error can happen
 * from anywhere, and the user can start a new session out of done / error
 * without waiting for the hide delay.
 */
export const TRANSITIONS: Record<AppStatus, readonly AppStatus[]> = {
  idle: ['listening', 'error'],
  listening: ['transcribing', 'error'],
  transcribing: ['pasting', 'done', 'error'],
  pasting: ['done', 'error'],
  done: ['listening', 'idle', 'error'],
  error: ['listening', 'idle']
}

/** True if `to` is a legal next status from `from`. Same-state is also allowed. */
export function isAllowedTransition(from: AppStatus, to: AppStatus): boolean {
  if (from === to) return true
  return TRANSITIONS[from].includes(to)
}

/** True if a new session may be started from this status. */
export function canStartSession(status: AppStatus): boolean {
  return status === 'idle' || status === 'done' || status === 'error'
}

/** True if the active session may be stopped from this status. */
export function canStopSession(status: AppStatus): boolean {
  return status === 'listening' || status === 'transcribing'
}
