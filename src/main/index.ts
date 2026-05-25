import { app, BrowserWindow, ipcMain, session, Tray } from 'electron'
import {
  IPC,
  type AppStatus,
  type RecordingChunkPayload,
  type RecordingErrorPayload,
  type StatusPayload
} from '@shared/ipc'
import type { SettingsSaveResult, SettingsUpdate } from '@shared/settings'
import { createMiniWindow } from './window'
import { registerHotkey, unregisterAll } from './hotkey'
import { createTray } from './tray'
import { RealtimeClient } from './realtimeClient'
import { copyAndPaste } from './paste'
import { getApiKey, getAppSettings, getHotkey, updateSettings } from './settings'
import { openSettingsWindow } from './settingsWindow'

let miniWindow: BrowserWindow | null = null
let tray: Tray | null = null
let currentStatus: AppStatus = 'idle'
let busy = false

let client: RealtimeClient | null = null
let sessionGeneration = 0
let lastFinalTranscript = ''

let activeHotkey = ''

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

/**
 * Phase 3+4: hotkey toggles a Realtime API transcription session and
 * pastes the final transcript into whatever app has focus.
 */
async function onHotkey(): Promise<void> {
  if (busy) return

  if (currentStatus === 'idle') {
    const key = await getApiKey()
    if (!key) {
      setStatus({
        status: 'error',
        error: 'OPENAI_API_KEY が未設定です。トレイ → 設定 から登録してください'
      })
      openSettingsWindow()
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

async function applyHotkey(accelerator: string): Promise<boolean> {
  unregisterAll()
  const ok = registerHotkey(accelerator, () => {
    void onHotkey()
  })
  if (ok) {
    activeHotkey = accelerator
    console.log(`[whisper-anywhere] hotkey 登録: ${accelerator}`)
  } else {
    console.error(`[whisper-anywhere] hotkey 登録失敗: ${accelerator}`)
  }
  return ok
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

  miniWindow.webContents.on('did-finish-load', () => {
    miniWindow?.webContents.send(IPC.StatusUpdate, {
      status: currentStatus
    } satisfies StatusPayload)
  })

  tray = createTray({
    openSettings: () => openSettingsWindow(),
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
    void sleep(3000).then(() => {
      setStatus({ status: 'idle' })
      busy = false
      client = null
    })
  })

  ipcMain.handle(IPC.SettingsGet, async () => getAppSettings())
  ipcMain.handle(
    IPC.SettingsSave,
    async (_e, update: SettingsUpdate): Promise<SettingsSaveResult> => {
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
        return { ok: false, error: message, settings: await getAppSettings() }
      }
    }
  )

  // First-launch helper: if no API key from settings or env, open the settings window.
  const initial = await getAppSettings()
  if (!initial.hasApiKey) {
    openSettingsWindow()
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
