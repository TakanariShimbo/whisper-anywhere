import { app, BrowserWindow, session, Tray } from 'electron'
import { registerIpcHandlers } from './ipcHandlers'
import { LogCategory, log } from './log'
import { unregisterAll } from './hotkey'
import { applyHotkey, setMiniWindow, showSettings } from './session'
import { getAppSettings, getHotkey } from './settings'
import { state } from './state/appState'
import { createTray } from './tray'
import { emitInitialStatus, setWindows } from './ui'
import { createMiniWindow } from './windows/mini'
import { createTranscriptWindow } from './windows/transcript'

let tray: Tray | null = null

async function bootstrap(): Promise<void> {
  log(LogCategory.Lifecycle, 'bootstrap')

  // Auto-grant microphone permissions to our own renderer.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'mediaKeySystem') {
      callback(true)
    } else {
      callback(false)
    }
  })

  // Create overlay windows up-front so they're warm by the time the user
  // triggers a session.
  const miniWindow = createMiniWindow()
  const transcriptWindow = createTranscriptWindow()
  setWindows(miniWindow, transcriptWindow)
  setMiniWindow(miniWindow)

  miniWindow.webContents.on('did-finish-load', emitInitialStatus)

  tray = createTray({
    openSettings: showSettings,
    quit: () => app.quit()
  })

  const hotkey = await getHotkey()
  await applyHotkey(hotkey)

  registerIpcHandlers()

  // First-launch helper: if no API key from settings or env, open settings.
  const initial = await getAppSettings()
  if (!initial.hasApiKey) {
    log(LogCategory.Lifecycle, 'no API key on first launch — opening settings')
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
  log(LogCategory.Lifecycle, 'will-quit')
  unregisterAll()
  state.client?.close()
  state.setClient(null)
  tray?.destroy()
  tray = null
})
