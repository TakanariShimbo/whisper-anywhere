import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { TRANSCRIPT_HEIGHT as HEIGHT, TRANSCRIPT_WIDTH as WIDTH } from './constants'

export function createTranscriptWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { workArea } = display

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    // Center of the primary display's work area.
    x: workArea.x + Math.round((workArea.width - WIDTH) / 2),
    y: workArea.y + Math.round((workArea.height - HEIGHT) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false, // do not steal focus from the user's app
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/transcript.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/transcript.html'))
  }

  return win
}
