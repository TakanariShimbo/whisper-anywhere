import { IPC } from '@shared/channels'
import {
  ERROR_HIDE_DELAY_MS,
  HIDE_DELAY_MS,
  HOTKEY_COOLDOWN_MS,
  TRANSIENT_ERROR_HIDE_MS
} from './constants'
import { registerHotkey, unregisterAll } from './hotkey'
import { LogCategory, log, logError } from './log'
import { copyAndPaste } from './paste'
import { RealtimeClient } from './realtimeClient'
import { getApiKey, getLanguage } from './settings'
import { state } from './state/appState'
import { setStatus, setTranscript, showTranscript } from './ui'
import { sleep } from './utils/async'
import { openSettingsWindow } from './windows/settings'
import type { BrowserWindow } from 'electron'

/**
 * Owns the session lifecycle: hotkey → record → stream → paste → idle.
 * Also owns the global hotkey registration since registration is keyed to
 * onHotkey, and the pause/resume flow only exists to support the hotkey
 * capture UI in settings.
 *
 * Window references for the mini window come in via setMiniWindow() so
 * session can send RecordingStart/Stop without importing them.
 */

let miniWindow: BrowserWindow | null = null

export function setMiniWindow(w: BrowserWindow): void {
  miniWindow = w
}

/**
 * Open the settings window. Resumes the hotkey on close so the renderer
 * can't leave the global hotkey stuck in paused state (e.g. window closed
 * mid-capture).
 */
export function showSettings(): void {
  openSettingsWindow({ onClosed: () => void forceResumeHotkey() })
}

// ── hotkey wiring ─────────────────────────────────────────────────────────

/**
 * Register (or re-register) the global accelerator. If hotkey is currently
 * paused (settings capture UI), defers actual registration until resume().
 */
export async function applyHotkey(accelerator: string): Promise<boolean> {
  unregisterAll()
  if (state.hotkeyPaused) {
    state.setHotkeyAccel(accelerator)
    log(LogCategory.Hotkey, `deferred while paused (will register on resume): ${accelerator}`)
    return true
  }
  const ok = registerHotkey(accelerator, () => {
    void onHotkey()
  })
  if (ok) {
    state.setHotkeyAccel(accelerator)
    log(LogCategory.Hotkey, `registered: ${accelerator}`)
  } else {
    logError(LogCategory.Hotkey, `register FAILED: ${accelerator}`)
  }
  return ok
}

/** Pause the global hotkey (called when the settings window starts capture). */
export function pauseHotkey(): void {
  log(LogCategory.Hotkey, 'pause requested')
  state.setHotkeyPaused(true)
  unregisterAll()
}

/** Resume the global hotkey (called when capture ends). */
export async function resumeHotkey(): Promise<void> {
  log(LogCategory.Hotkey, 'resume requested')
  state.setHotkeyPaused(false)
  if (state.hotkeyAccel) await applyHotkey(state.hotkeyAccel)
}

/** Force-resume if the settings window closes while paused. */
async function forceResumeHotkey(): Promise<void> {
  if (!state.hotkeyPaused) return
  log(LogCategory.Hotkey, 'force-resume (settings closed while paused)')
  state.setHotkeyPaused(false)
  if (state.hotkeyAccel) await applyHotkey(state.hotkeyAccel)
}

// ── session lifecycle ─────────────────────────────────────────────────────

/**
 * Top-level hotkey handler. Debounces, then either starts a new session
 * (when idle / done / error) or signals the active session to stop (when
 * listening / transcribing). 'pasting' is busy and falls through to the
 * busy guard.
 */
async function onHotkey(): Promise<void> {
  const sinceLast = state.msSinceHotkeyFired()
  if (sinceLast < HOTKEY_COOLDOWN_MS) {
    log(LogCategory.Hotkey, `debounced (Δ=${sinceLast}ms, status=${state.status})`)
    return
  }
  state.markHotkeyFired()

  if (state.busy) {
    log(LogCategory.Hotkey, `ignored (busy, status=${state.status})`)
    return
  }

  log(LogCategory.Hotkey, `fired (status=${state.status})`)

  if (state.status === 'listening' || state.status === 'transcribing') {
    state.setBusy(true)
    setStatus({ status: 'transcribing', text: '確定待ち…' })
    miniWindow?.webContents.send(IPC.RecordingStop)
    state.client?.stop()
    return
  }

  const key = await getApiKey()
  if (!key) {
    log(LogCategory.Hotkey, 'no API key — opening settings')
    setStatus({
      status: 'error',
      error: 'OPENAI_API_KEY が未設定です。トレイ → 設定 から登録してください'
    })
    showSettings()
    void sleep(TRANSIENT_ERROR_HIDE_MS).then(() => setStatus({ status: 'idle' }))
    return
  }
  void startSession(key)
}

async function startSession(apiKey: string): Promise<void> {
  const myGen = state.nextSession()
  state.setLastFinal('')
  setTranscript('') // clear leftover text from any previous session
  showTranscript() // surface the panel immediately so the placeholder is visible

  // language hint is optional; '' means let the API auto-detect.
  const language = await getLanguage()
  log(LogCategory.Realtime, `session#${myGen} starting (lang=${language || 'auto'})`)

  const c = new RealtimeClient(apiKey, language)
  state.setClient(c)

  c.on('ready', () => {
    if (myGen !== state.sessionGen) return
    log(LogCategory.Realtime, `session#${myGen} ready`)
  })

  c.on('partial', (text) => {
    if (myGen !== state.sessionGen) return
    setTranscript(text)
  })

  c.on('final', (text) => {
    if (myGen !== state.sessionGen) return
    state.setLastFinal(text)
    log(LogCategory.Realtime, `session#${myGen} final(${text.length} chars)`)
    setTranscript(text)
  })

  c.on('error', (err) => {
    if (myGen !== state.sessionGen) return
    logError(LogCategory.Realtime, `session#${myGen} error: ${err.message}`)
    setStatus({ status: 'error', error: err.message })
    // Cleanup (busy=false, idle) happens via 'closed' → finalizeSession.
  })

  c.on('closed', () => {
    if (myGen !== state.sessionGen) return
    log(LogCategory.Realtime, `session#${myGen} closed`)
    void finalizeSession(myGen)
  })

  setStatus({ status: 'listening', text: '聞き取り中…' })
  miniWindow?.webContents.send(IPC.RecordingStart)
  c.start()
}

async function finalizeSession(myGen: number): Promise<void> {
  // Ensure the renderer-side recorder is torn down on every session end,
  // including the error path. Recorder.stop() is idempotent.
  miniWindow?.webContents.send(IPC.RecordingStop)

  // If the session already ended in error, keep the error label visible —
  // don't overwrite it with 'done' / '完了' (flipping red → green would
  // hide the failure).
  const alreadyError = state.status === 'error'

  if (!alreadyError) {
    const transcript = state.lastFinal.trim()
    if (transcript) {
      setStatus({ status: 'pasting', text: transcript })
      try {
        const method = await copyAndPaste(transcript)
        const label = method === 'none' ? `コピー: ${transcript}` : transcript
        setStatus({ status: 'done', text: label })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setStatus({ status: 'error', error: `貼り付け失敗: ${message}` })
      }
    } else {
      setStatus({ status: 'done', text: '（文字起こしなし）' })
    }
  }

  // Release the busy lock so the next hotkey press can interrupt the
  // visual hold.
  if (myGen === state.sessionGen) {
    state.setBusy(false)
    state.setClient(null)
  }

  const holdMs = state.status === 'error' ? ERROR_HIDE_DELAY_MS : HIDE_DELAY_MS
  await sleep(holdMs)
  if (myGen === state.sessionGen && (state.status === 'done' || state.status === 'error')) {
    setStatus({ status: 'idle' })
  }
}

// ── handlers for IPC-originated events ────────────────────────────────────

/** Renderer reported it can't open the mic. Show error, drop the session. */
export function handleRecordingError(message: string): void {
  setStatus({ status: 'error', error: message })
  state.client?.close()
  void sleep(TRANSIENT_ERROR_HIDE_MS).then(() => {
    setStatus({ status: 'idle' })
    state.setBusy(false)
    state.setClient(null)
  })
}

/** Forward a PCM chunk from the renderer to the active Realtime session. */
export function handleRecordingChunk(pcm: ArrayBuffer): void {
  state.client?.sendChunk(pcm)
}
