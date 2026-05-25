import { app, BrowserWindow, ipcMain, Tray } from 'electron'
import { IPC, type AppStatus, type StatusPayload } from '@shared/ipc'
import { createMiniWindow } from './window'
import { DEFAULT_HOTKEY, registerHotkey, unregisterAll } from './hotkey'
import { createTray } from './tray'
import { copyAndPaste } from './paste'

let miniWindow: BrowserWindow | null = null
let tray: Tray | null = null
let currentStatus: AppStatus = 'idle'
let busy = false

const HIDE_DELAY_MS = 1000

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
 * Phase 1: hotkey toggles a fake "listen → transcribe → paste" flow
 * with a fixed string. Audio + Realtime API come in later phases.
 */
async function onHotkey(): Promise<void> {
  if (busy) return

  // First press while idle → start listening.
  if (currentStatus === 'idle') {
    setStatus({ status: 'listening', text: '聞き取り中…' })
    return
  }

  // Second press while listening → fake transcribe → paste.
  if (currentStatus === 'listening') {
    busy = true
    try {
      setStatus({ status: 'transcribing', text: '文字起こし中…' })
      await sleep(400)

      const fakeText = 'WhisperAnywhere からこんにちは。'
      setStatus({ status: 'pasting', text: fakeText })

      const method = await copyAndPaste(fakeText)
      setStatus({
        status: 'done',
        text: method === 'none' ? 'コピーしました（手動でペースト）' : '貼り付けました'
      })

      await sleep(HIDE_DELAY_MS)
      setStatus({ status: 'idle' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus({ status: 'error', error: message })
      await sleep(2500)
      setStatus({ status: 'idle' })
    } finally {
      busy = false
    }
  }
}

function bootstrap(): void {
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

  const ok = registerHotkey(DEFAULT_HOTKEY, () => {
    void onHotkey()
  })
  if (!ok) {
    console.error(`[whisper-anywhere] hotkey 登録失敗: ${DEFAULT_HOTKEY}`)
  } else {
    console.log(`[whisper-anywhere] hotkey 登録: ${DEFAULT_HOTKEY}`)
  }

  ipcMain.on(IPC.RequestQuit, () => app.quit())
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
