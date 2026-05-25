import { app, BrowserWindow, ipcMain, Notification, session, Tray } from 'electron'
import appIconPath from './assets/app-icon-256.png?asset'
import { IPC } from '@shared/channels'
import type {
  AppStatus,
  RecordingChunkPayload,
  RecordingErrorPayload,
  StatusPayload,
  TranscriptPayload
} from '@shared/events'
import type { SettingsSaveResult, SettingsUpdate } from '@shared/settings'
import { createMiniWindow } from './windows/mini'
import { createTranscriptWindow } from './windows/transcript'
import { registerHotkey, unregisterAll } from './hotkey'
import { createTray } from './tray'
import { RealtimeClient } from './realtimeClient'
import { copyAndPaste } from './paste'
import { getApiKey, getAppSettings, getHotkey, updateSettings } from './settings'
import { openSettingsWindow } from './windows/settings'
import { LogCategory, log, logError } from './log'
import {
  ERROR_HIDE_DELAY_MS,
  HIDE_DELAY_MS,
  HOTKEY_COOLDOWN_MS,
  TRANSIENT_ERROR_HIDE_MS
} from './constants'
import { sleep } from './utils/async'
import { truncate } from './utils/string'

let miniWindow: BrowserWindow | null = null
let transcriptWindow: BrowserWindow | null = null
let tray: Tray | null = null
let currentStatus: AppStatus = 'idle'
let busy = false

let client: RealtimeClient | null = null
let sessionGeneration = 0
let lastFinalTranscript = ''

let activeHotkey = ''
let hotkeyPaused = false
let lastHotkeyAt = 0

function setStatus(payload: StatusPayload): void {
  const prev = currentStatus
  currentStatus = payload.status
  if (prev !== payload.status) {
    const detail = payload.error
      ? ` error="${truncate(payload.error)}"`
      : payload.text
        ? ` "${truncate(payload.text)}"`
        : ''
    log(LogCategory.Status, `${prev} → ${payload.status}${detail}`)
  }
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send(IPC.StatusUpdate, payload)
    if (payload.status === 'idle') {
      miniWindow.hide()
    } else if (!miniWindow.isVisible()) {
      miniWindow.showInactive() // show without stealing focus
    }
  }
  // Transcript window follows the same visibility rule as the indicator:
  // visible during an active session, hidden when we're idle.
  if (payload.status === 'idle') {
    setTranscript('')
  }
  // Surface error details via a native OS notification so the user can read
  // them at leisure — the mini window itself only shows a status label.
  if (prev !== 'error' && payload.status === 'error' && payload.error) {
    showErrorNotification(payload.error)
  }
}

function setTranscript(text: string): void {
  if (!transcriptWindow || transcriptWindow.isDestroyed()) return
  const payload: TranscriptPayload = { text }
  transcriptWindow.webContents.send(IPC.TranscriptUpdate, payload)
  if (text) {
    if (!transcriptWindow.isVisible()) transcriptWindow.showInactive()
  } else {
    if (transcriptWindow.isVisible()) transcriptWindow.hide()
  }
}

function showErrorNotification(message: string): void {
  if (!Notification.isSupported()) {
    log(LogCategory.Notification, `(unsupported) ${message}`)
    return
  }
  try {
    new Notification({
      title: 'WhisperAnywhere エラー',
      body: message,
      icon: appIconPath,
      urgency: 'critical' // Linux: don't auto-dismiss; user must close it
    }).show()
  } catch (err) {
    logError(LogCategory.Notification, `failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Phase 3+4: hotkey toggles a Realtime API transcription session and
 * pastes the final transcript into whatever app has focus.
 */
async function onHotkey(): Promise<void> {
  const now = Date.now()
  const sinceLast = now - lastHotkeyAt
  // Debounce: X11 key auto-repeat / OS-level double dispatch can fire the
  // shortcut twice for a single user press. Without this, the second fire
  // would immediately flip listening → transcribing.
  if (sinceLast < HOTKEY_COOLDOWN_MS) {
    log(LogCategory.Hotkey, `debounced (Δ=${sinceLast}ms, status=${currentStatus})`)
    return
  }
  lastHotkeyAt = now

  if (busy) {
    log(LogCategory.Hotkey, `ignored (busy, status=${currentStatus})`)
    return
  }

  log(LogCategory.Hotkey, `fired (status=${currentStatus})`)

  // Active session → stop it.
  if (currentStatus === 'listening' || currentStatus === 'transcribing') {
    busy = true
    setStatus({ status: 'transcribing', text: '確定待ち…' })
    miniWindow?.webContents.send(IPC.RecordingStop)
    client?.stop()
    return
  }

  // idle / done / error → start a new session.
  // (`pasting` is still busy=true, so it's caught by the guard above.)
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
  startSession(key)
}

function startSession(apiKey: string): void {
  sessionGeneration += 1
  const myGen = sessionGeneration
  lastFinalTranscript = ''
  setTranscript('') // clear leftover text from any previous session
  log(LogCategory.Realtime, `session#${myGen} starting`)

  const c = new RealtimeClient(apiKey)
  client = c

  c.on('ready', () => {
    if (myGen !== sessionGeneration) return
    log(LogCategory.Realtime, `session#${myGen} ready`)
  })

  c.on('partial', (text) => {
    if (myGen !== sessionGeneration) return
    setTranscript(text)
  })

  c.on('final', (text) => {
    if (myGen !== sessionGeneration) return
    lastFinalTranscript = text
    log(LogCategory.Realtime, `session#${myGen} final(${text.length} chars)`)
    setTranscript(text)
  })

  c.on('error', (err) => {
    if (myGen !== sessionGeneration) return
    logError(LogCategory.Realtime, `session#${myGen} error: ${err.message}`)
    setStatus({ status: 'error', error: err.message })
    // Cleanup (busy=false, idle) happens via the 'closed' event → finalizeSession.
    // ws errors normally trigger a close immediately after, so we don't need
    // a separate timer here.
  })

  c.on('closed', () => {
    if (myGen !== sessionGeneration) return
    log(LogCategory.Realtime, `session#${myGen} closed`)
    void finalizeSession(myGen)
  })

  setStatus({ status: 'listening', text: '聞き取り中…' })
  miniWindow?.webContents.send(IPC.RecordingStart)
  c.start()
}

async function finalizeSession(myGen: number): Promise<void> {
  // Ensure the renderer-side recorder is torn down on every session end,
  // including the error path (which never sends RecordingStop otherwise).
  // Recorder.stop() is idempotent, so a duplicate stop from the normal
  // hotkey-stop path is harmless.
  miniWindow?.webContents.send(IPC.RecordingStop)

  // If the session already ended in error, don't overwrite the error label
  // with 'done' / '完了' — that'd flip the indicator from red to green and
  // hide the failure. Just keep the error state and let it time out.
  const alreadyError = currentStatus === 'error'

  if (!alreadyError) {
    const transcript = lastFinalTranscript.trim()
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

  // Paste / display is done — release the busy lock so the next hotkey press
  // can start a new session even while we're still holding the result on-screen.
  if (myGen === sessionGeneration) {
    busy = false
    client = null
  }

  // Visual hold: errors get a longer hold so the user can react before the
  // indicator hides (the notification persists separately).
  const holdMs = currentStatus === 'error' ? ERROR_HIDE_DELAY_MS : HIDE_DELAY_MS
  await sleep(holdMs)
  if (
    myGen === sessionGeneration &&
    (currentStatus === 'done' || currentStatus === 'error')
  ) {
    setStatus({ status: 'idle' })
  }
}

async function applyHotkey(accelerator: string): Promise<boolean> {
  unregisterAll()
  if (hotkeyPaused) {
    // Defer actual registration; remember the desired accelerator so resume() picks it up.
    activeHotkey = accelerator
    log(LogCategory.Hotkey, `deferred while paused (will register on resume): ${accelerator}`)
    return true
  }
  const ok = registerHotkey(accelerator, () => {
    void onHotkey()
  })
  if (ok) {
    activeHotkey = accelerator
    log(LogCategory.Hotkey, `registered: ${accelerator}`)
  } else {
    logError(LogCategory.Hotkey, `register FAILED: ${accelerator}`)
  }
  return ok
}

/** Force-resume the global hotkey. Safe no-op if not paused. */
async function forceResumeHotkey(): Promise<void> {
  if (!hotkeyPaused) return
  log(LogCategory.Hotkey, 'force-resume (settings closed while paused)')
  hotkeyPaused = false
  if (activeHotkey) await applyHotkey(activeHotkey)
}

function showSettings(): void {
  // Always force-resume on close so the renderer can't leave the global
  // hotkey stuck in paused state (e.g. window closed mid-capture).
  openSettingsWindow({ onClosed: () => void forceResumeHotkey() })
}

async function bootstrap(): Promise<void> {
  // Auto-grant microphone permissions to our own renderer.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'mediaKeySystem') {
      callback(true)
    } else {
      callback(false)
    }
  })

  miniWindow = createMiniWindow()
  transcriptWindow = createTranscriptWindow()

  miniWindow.webContents.on('did-finish-load', () => {
    miniWindow?.webContents.send(IPC.StatusUpdate, {
      status: currentStatus
    } satisfies StatusPayload)
  })

  tray = createTray({
    openSettings: () => showSettings(),
    quit: () => app.quit()
  })

  const hotkey = await getHotkey()
  await applyHotkey(hotkey)

  ipcMain.on(IPC.RequestQuit, () => app.quit())
  ipcMain.on(IPC.RecordingChunk, (_e, payload: RecordingChunkPayload) => {
    client?.sendChunk(payload.pcm)
  })
  ipcMain.on(IPC.RecordingError, (_e, payload: RecordingErrorPayload) => {
    setStatus({ status: 'error', error: payload.message })
    client?.close()
    void sleep(TRANSIENT_ERROR_HIDE_MS).then(() => {
      setStatus({ status: 'idle' })
      busy = false
      client = null
    })
  })

  ipcMain.handle(IPC.HotkeyPause, () => {
    log(LogCategory.Hotkey, 'pause requested')
    hotkeyPaused = true
    unregisterAll()
  })
  ipcMain.handle(IPC.HotkeyResume, async () => {
    log(LogCategory.Hotkey, 'resume requested')
    hotkeyPaused = false
    if (activeHotkey) await applyHotkey(activeHotkey)
  })

  ipcMain.handle(IPC.SettingsGet, async () => getAppSettings())
  ipcMain.handle(
    IPC.SettingsSave,
    async (_e, update: SettingsUpdate): Promise<SettingsSaveResult> => {
      log(
        LogCategory.Settings,
        `save: ${update.hotkey ? `hotkey=${update.hotkey} ` : ''}${
          update.apiKey === null
            ? 'apiKey=null '
            : update.apiKey !== undefined
              ? 'apiKey=*** '
              : ''
        }`.trim() || 'save: (no changes)'
      )
      try {
        const previousHotkey = activeHotkey
        const settings = await updateSettings(update)
        if (settings.hotkey !== previousHotkey) {
          const ok = await applyHotkey(settings.hotkey)
          if (!ok) {
            // Re-register the previous one so the app stays usable.
            await applyHotkey(previousHotkey)
            return {
              ok: false,
              error: `ホットキー登録失敗: ${settings.hotkey}`,
              settings: await getAppSettings()
            }
          }
        }
        return { ok: true, settings }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logError(LogCategory.Settings, `save failed: ${message}`)
        return { ok: false, error: message, settings: await getAppSettings() }
      }
    }
  )

  // First-launch helper: if no API key from settings or env, open the settings window.
  const initial = await getAppSettings()
  if (!initial.hasApiKey) {
    showSettings()
  }
}

app.whenReady().then(() => {
  void bootstrap()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void bootstrap()
  })
})

// Tray-resident app — never quit when the window closes.
app.on('window-all-closed', () => {
  // do nothing
})

app.on('will-quit', () => {
  unregisterAll()
  client?.close()
  client = null
  tray?.destroy()
  tray = null
})
