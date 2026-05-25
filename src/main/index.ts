import { app, BrowserWindow, ipcMain, session, Tray } from 'electron'
import { basename } from 'node:path'
import {
  IPC,
  type AppStatus,
  type RecordingErrorPayload,
  type RecordingResultPayload,
  type StatusPayload
} from '@shared/ipc'
import { createMiniWindow } from './window'
import { DEFAULT_HOTKEY, registerHotkey, unregisterAll } from './hotkey'
import { createTray } from './tray'
import { saveRecording } from './audio'

let miniWindow: BrowserWindow | null = null
let tray: Tray | null = null
let currentStatus: AppStatus = 'idle'
let busy = false

const HIDE_DELAY_MS = 1200

function setStatus(payload: StatusPayload): void {
  currentStatus = payload.status
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send(IPC.StatusUpdate, payload)
    if (payload.status === 'idle') {
      miniWindow.hide()
    } else if (!miniWindow.isVisible()) {
      miniWindow.showInactive() // show without stealing focus
    }
  }
}

/**
 * Phase 2: hotkey toggles mic recording. On second press the renderer stops
 * the mic and posts the PCM back via IPC, where we encode it as WAV and save
 * under userData/recordings/. Phase 3 will replace the save step with a
 * Realtime API session.
 */
function onHotkey(): void {
  if (busy) return

  if (currentStatus === 'idle') {
    setStatus({ status: 'listening', text: '聞き取り中…' })
    miniWindow?.webContents.send(IPC.RecordingStart)
    return
  }

  if (currentStatus === 'listening') {
    busy = true
    setStatus({ status: 'transcribing', text: '保存中…' })
    miniWindow?.webContents.send(IPC.RecordingStop)
    // Wait for RecordingResult / RecordingError; busy clears in those handlers.
  }
}

async function handleRecordingResult(payload: RecordingResultPayload): Promise<void> {
  try {
    if (payload.pcm.byteLength === 0) {
      setStatus({ status: 'done', text: '音声なし' })
    } else {
      const path = await saveRecording(payload.pcm, payload.sampleRate)
      const seconds = (payload.durationMs / 1000).toFixed(1)
      console.log(`[whisper-anywhere] saved ${path} (${seconds}s)`)
      setStatus({ status: 'done', text: `保存: ${basename(path)} (${seconds}s)` })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setStatus({ status: 'error', error: message })
    await sleep(2500)
  } finally {
    await sleep(HIDE_DELAY_MS)
    setStatus({ status: 'idle' })
    busy = false
  }
}

async function handleRecordingError(payload: RecordingErrorPayload): Promise<void> {
  setStatus({ status: 'error', error: payload.message })
  await sleep(2500)
  setStatus({ status: 'idle' })
  busy = false
}

function bootstrap(): void {
  // Auto-grant microphone / media permissions to our own renderer.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'mediaKeySystem') {
      callback(true)
    } else {
      callback(false)
    }
  })

  miniWindow = createMiniWindow()

  // Re-send status when renderer is ready (e.g. after dev reload).
  miniWindow.webContents.on('did-finish-load', () => {
    miniWindow?.webContents.send(IPC.StatusUpdate, {
      status: currentStatus
    } satisfies StatusPayload)
  })

  tray = createTray(() => {
    app.quit()
  })

  const ok = registerHotkey(DEFAULT_HOTKEY, onHotkey)
  if (!ok) {
    console.error(`[whisper-anywhere] hotkey 登録失敗: ${DEFAULT_HOTKEY}`)
  } else {
    console.log(`[whisper-anywhere] hotkey 登録: ${DEFAULT_HOTKEY}`)
  }

  ipcMain.on(IPC.RequestQuit, () => app.quit())
  ipcMain.on(IPC.RecordingResult, (_e, payload: RecordingResultPayload) => {
    void handleRecordingResult(payload)
  })
  ipcMain.on(IPC.RecordingError, (_e, payload: RecordingErrorPayload) => {
    void handleRecordingError(payload)
  })
}

app.whenReady().then(() => {
  bootstrap()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) bootstrap()
  })
})

// Keep running when all windows are closed — this is a tray-resident app.
app.on('window-all-closed', () => {
  // do nothing
})

app.on('will-quit', () => {
  unregisterAll()
  tray?.destroy()
  tray = null
})

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
