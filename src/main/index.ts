import { app, BrowserWindow, session, Tray } from 'electron'
import { IPC } from '@shared/channels'
import type { UILanguage } from '@shared/i18n'
import { registerIpcHandlers } from './ipcHandlers'
import { LogCategory, log } from './log'
import { unregisterAll } from './hotkey'
import { applyHotkey, setMiniWindow, showSettings } from './session'
import { applyAutoStart } from './services/autoStart'
import {
  getAppSettings,
  getHotkey,
  getUILanguage,
  isFirstLaunch,
  markFirstLaunchComplete
} from './settings'
import { setCurrentUILanguage } from './i18n'
import { state } from './state/appState'
import { applyTrayMenu, createTray, type TrayActions } from './tray'
import { emitInitialStatus, setWindows } from './ui'
import { createMiniWindow } from './windows/mini'
import { createTranscriptWindow } from './windows/transcript'

// Single-instance lock: if another instance is already running, exit
// immediately. The running instance receives a 'second-instance' event and
// can react (here: pop the settings window so the user sees something
// happened). Must run BEFORE app.whenReady so the second instance never
// reaches bootstrap.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  log(LogCategory.Lifecycle, 'another instance is running — exiting')
  app.quit()
}

app.on('second-instance', () => {
  log(LogCategory.Lifecycle, 'second-instance launch detected — surfacing settings window')
  showSettings()
})

let tray: Tray | null = null

async function bootstrap(): Promise<void> {
  log(LogCategory.Lifecycle, 'bootstrap')

  // Initialise the UI language as early as possible so tray menu / status
  // strings come out correctly on first paint.
  setCurrentUILanguage(await getUILanguage())

  // Auto-grant microphone permissions to our own renderer.
  // Newer Chromium (Electron 32+) runs a synchronous permission CHECK before
  // dispatching the (async) permission REQUEST, so both handlers must allow
  // 'media' or getUserMedia rejects with AbortError before our request
  // handler even fires.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'mediaKeySystem')
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'media' || permission === 'mediaKeySystem'
  })

  // Create overlay windows up-front so they're warm by the time the user
  // triggers a session.
  const miniWindow = createMiniWindow()
  const transcriptWindow = createTranscriptWindow()
  setWindows(miniWindow, transcriptWindow)
  setMiniWindow(miniWindow)

  miniWindow.webContents.on('did-finish-load', emitInitialStatus)

  const trayActions: TrayActions = {
    openSettings: showSettings,
    restart: () => {
      log(LogCategory.Lifecycle, 'restart requested')
      app.relaunch()
      app.quit()
    },
    quit: () => app.quit()
  }
  tray = createTray(trayActions)

  const hotkey = await getHotkey()
  await applyHotkey(hotkey)

  registerIpcHandlers({
    onUILanguageChanged: (lang: UILanguage) => {
      setCurrentUILanguage(lang)
      // Rebuild the tray menu so it picks up the new translations.
      if (tray) applyTrayMenu(tray, trayActions)
      // Broadcast to every renderer so live windows reflow without a restart.
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send(IPC.SettingsChanged, lang)
      }
    }
  })

  // First-launch defaults: enable launch-at-login by default (matching the
  // "tray-resident" mental model of the app). Only on packaged builds —
  // applyAutoStart no-ops in dev anyway, but skipping the marker file write
  // in dev means a packaged install on the same machine still gets the
  // first-launch experience.
  if (app.isPackaged && (await isFirstLaunch())) {
    log(LogCategory.Lifecycle, 'first launch — enabling autoStart by default')
    await applyAutoStart(true)
    await markFirstLaunchComplete()
  }

  // First-launch helper: if no API key from settings or env, open settings.
  const initial = await getAppSettings()
  if (!initial.hasApiKey) {
    log(LogCategory.Lifecycle, 'no API key — opening settings')
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
