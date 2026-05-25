import type { AppStatus } from '@shared/events'
import type { RealtimeClient } from '../realtimeClient'

/**
 * Single source of truth for the main process's mutable state.
 *
 * Replaces the scattered top-level `let` variables that used to live in
 * src/main/index.ts. Reads happen through getters; writes happen through
 * explicit mutator methods so every mutation site is greppable
 * (`state.setBusy(true)` vs an invisible `busy = true`).
 *
 * Two domains live here:
 *   - session: status / busy / client / generation / lastFinalTranscript
 *   - hotkey:  active accelerator / paused flag / debounce timestamp
 *
 * Window handles (mini, transcript, settings) and the tray are
 * infrastructure rather than runtime state, so they stay in the bootstrap
 * module — they're created once and don't change with the state machine.
 */
export class AppState {
  // ── session ──────────────────────────────────────────────────────────
  #status: AppStatus = 'idle'
  #busy = false
  #client: RealtimeClient | null = null
  #sessionGen = 0
  #lastFinal = ''

  // ── hotkey ───────────────────────────────────────────────────────────
  #hotkeyAccel = ''
  #hotkeyPaused = false
  #hotkeyLastFiredAt = 0

  // ── session getters ──────────────────────────────────────────────────
  get status(): AppStatus {
    return this.#status
  }
  get busy(): boolean {
    return this.#busy
  }
  get client(): RealtimeClient | null {
    return this.#client
  }
  get sessionGen(): number {
    return this.#sessionGen
  }
  get lastFinal(): string {
    return this.#lastFinal
  }

  // ── session mutators ─────────────────────────────────────────────────
  setStatus(s: AppStatus): void {
    this.#status = s
  }
  setBusy(b: boolean): void {
    this.#busy = b
  }
  setClient(c: RealtimeClient | null): void {
    this.#client = c
  }
  /** Bump the session generation and return the new value. */
  nextSession(): number {
    this.#sessionGen += 1
    return this.#sessionGen
  }
  setLastFinal(s: string): void {
    this.#lastFinal = s
  }

  // ── hotkey getters ───────────────────────────────────────────────────
  get hotkeyAccel(): string {
    return this.#hotkeyAccel
  }
  get hotkeyPaused(): boolean {
    return this.#hotkeyPaused
  }

  // ── hotkey mutators ──────────────────────────────────────────────────
  setHotkeyAccel(s: string): void {
    this.#hotkeyAccel = s
  }
  setHotkeyPaused(b: boolean): void {
    this.#hotkeyPaused = b
  }
  /** Record that the hotkey just fired. */
  markHotkeyFired(): void {
    this.#hotkeyLastFiredAt = Date.now()
  }
  /** Milliseconds since the last hotkey fire (Number.MAX if never fired). */
  msSinceHotkeyFired(): number {
    if (this.#hotkeyLastFiredAt === 0) return Number.MAX_SAFE_INTEGER
    return Date.now() - this.#hotkeyLastFiredAt
  }
}

/** Process-wide singleton. */
export const state = new AppState()
