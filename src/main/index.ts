import { app, BrowserWindow, ipcMain, session, Tray } from 'electron'
import {
  IPC,
  type AppStatus,
  type RecordingChunkPayload,
  type RecordingErrorPayload,
  type StatusPayload
} from '@shared/ipc'
import { createMiniWindow } from './window'
import { DEFAULT_HOTKEY, registerHotkey, unregisterAll } from './hotkey'
import { createTray } from './tray'
import { RealtimeClient } from './realtimeClient'
import { copyAndPaste } from './paste'

let miniWindow: BrowserWindow | null = null
let tray: Tray | null = null
let currentStatus: AppStatus = 'idle'
let busy = false

let client: RealtimeClient | null = null
let sessionGeneration = 0
let lastFinalTranscript = ''

const HIDE_DELAY_MS = 2500

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

function getApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  return key && key.length > 0 ? key : null
}

/**
 * Phase 3: hotkey toggles a Realtime API transcription session.
 * - first press: open mic + connect WS, partial transcripts stream live
 * - second press: stop mic, commit, wait briefly for final, display it
 */
function onHotkey(): void {
  if (busy) return

  if (currentStatus === 'idle') {
    const key = getApiKey()
    if (!key) {
      setStatus({
        status: 'error',
        error: 'OPENAI_API_KEY が未設定です（環境変数で渡してください）'
      })
      void sleep(3000).then(() => setStatus({ status: 'idle' }))
      return
    }
    startSession(key)
    return
  }

  if (currentStatus === 'listening' || currentStatus === 'transcribing') {
    busy = true
    setStatus({ status: 'transcribing', text: '確定待ち…' })
    miniWindow?.webContents.send(IPC.RecordingStop)
    client?.stop()
  }
}

function startSession(apiKey: string): void {
  sessionGeneration += 1
  const myGen = sessionGeneration
  lastFinalTranscript = ''

  const c = new RealtimeClient(apiKey)
  client = c

  c.on('ready', () => {
    if (myGen !== sessionGeneration) return
    console.log('[whisper-anywhere] realtime session ready')
  })

  c.on('partial', (text) => {
    if (myGen !== sessionGeneration) return
    if (currentStatus === 'listening' || currentStatus === 'transcribing') {
      setStatus({ status: currentStatus, text })
    }
  })

  c.on('final', (text) => {
    if (myGen !== sessionGeneration) return
    lastFinalTranscript = text
    if (currentStatus === 'listening' || currentStatus === 'transcribing') {
      setStatus({ status: currentStatus, text })
    }
  })

  c.on('error', (err) => {
    if (myGen !== sessionGeneration) return
    console.error('[whisper-anywhere] realtime error', err)
    setStatus({ status: 'error', error: err.message })
    void sleep(3000).then(() => {
      if (myGen === sessionGeneration) {
        setStatus({ status: 'idle' })
        busy = false
      }
    })
  })

  c.on('closed', () => {
    if (myGen !== sessionGeneration) return
    void finalizeSession(myGen)
  })

  setStatus({ status: 'listening', text: '聞き取り中…' })
  miniWindow?.webContents.send(IPC.RecordingStart)
  c.start()
}

/**
 * Called after the WS session closes. If we captured a final transcript,
 * copy + paste it into whatever app has focus, then return to idle.
 */
async function finalizeSession(myGen: number): Promise<void> {
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
      await sleep(2500)
    }
  } else {
    setStatus({ status: 'done', text: '（文字起こしなし）' })
  }

  await sleep(HIDE_DELAY_MS)
  if (myGen === sessionGeneration) {
    setStatus({ status: 'idle' })
    busy = false
    client = null
  }
}

function bootstrap(): void {
  // Auto-grant microphone permissions to our own renderer.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'mediaKeySystem') {
      callback(true)
    } else {
      callback(false)
    }
  })

  miniWindow = createMiniWindow()

  miniWindow.webContents.on('did-finish-load', () => {
    miniWindow?.webContents.send(IPC.StatusUpdate, {
      status: currentStatus
    } satisfies StatusPayload)
  })

  tray = createTray(() => app.quit())

  const ok = registerHotkey(DEFAULT_HOTKEY, onHotkey)
  if (!ok) {
    console.error(`[whisper-anywhere] hotkey 登録失敗: ${DEFAULT_HOTKEY}`)
  } else {
    console.log(`[whisper-anywhere] hotkey 登録: ${DEFAULT_HOTKEY}`)
  }

  ipcMain.on(IPC.RequestQuit, () => app.quit())
  ipcMain.on(IPC.RecordingChunk, (_e, payload: RecordingChunkPayload) => {
    client?.sendChunk(payload.pcm)
  })
  ipcMain.on(IPC.RecordingError, (_e, payload: RecordingErrorPayload) => {
    setStatus({ status: 'error', error: payload.message })
    client?.close()
    void sleep(3000).then(() => {
      setStatus({ status: 'idle' })
      busy = false
      client = null
    })
  })
}

app.whenReady().then(() => {
  bootstrap()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) bootstrap()
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
