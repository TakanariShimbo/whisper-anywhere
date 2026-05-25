import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import appIconPath from './assets/app-icon-256.png?asset'
import { SETTINGS_HEIGHT, SETTINGS_WIDTH } from './constants'

let settingsWindow: BrowserWindow | null = null

export interface SettingsWindowOptions {
  onClosed?: () => void
}

export function openSettingsWindow(options: SettingsWindowOptions = {}): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return settingsWindow
  }

  const win = new BrowserWindow({
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    title: 'WhisperAnywhere 設定',
    autoHideMenuBar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    show: false,
    icon: appIconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    settingsWindow = null
    options.onClosed?.()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/settings.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/settings.html'))
  }

  settingsWindow = win
  return win
}
