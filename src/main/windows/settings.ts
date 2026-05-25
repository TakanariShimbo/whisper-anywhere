import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import appIconPath from '../assets/app-icon-256.png?asset'
import { SETTINGS_HEIGHT, SETTINGS_WIDTH } from '../constants'
import { loadEntry } from './factory'

let settingsWindow: BrowserWindow | null = null

export interface SettingsWindowOptions {
  onClosed?: () => void
}

/**
 * Standard framed window for configuring API key, hotkey, etc.
 * Singleton — repeated calls focus the existing window.
 */
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

  loadEntry(win, 'settings.html')

  settingsWindow = win
  return win
}
