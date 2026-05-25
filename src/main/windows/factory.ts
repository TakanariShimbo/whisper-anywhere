import { BrowserWindow, screen, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'node:path'

export interface OverlayWindowConfig {
  /** Width × height in CSS pixels. */
  width: number
  height: number
  /** Where on the primary work area to place the window. */
  position: OverlayPosition
  /** Path to the bundled HTML entry (e.g. 'index.html', 'transcript.html'). */
  htmlEntry: string
  /** Optional window-specific overrides. */
  options?: Partial<BrowserWindowConstructorOptions>
}

/**
 * Placement helpers. The window is positioned within the primary display's
 * work area (i.e. excluding the dock / panel). `margin` only applies to
 * edge-anchored placements.
 */
export type OverlayPosition =
  | { type: 'bottom-right'; margin: number }
  | { type: 'center' }
  | { type: 'absolute'; x: number; y: number }

/**
 * Creates a frameless, transparent, non-focusable overlay window — the shared
 * shape used by both the status indicator and the transcript panel.
 *
 * The caller supplies size, placement and an HTML entry; everything else
 * (transparency, alwaysOnTop, skipTaskbar, preload, etc.) is wired here so
 * each window type stays a thin wrapper.
 */
export function createOverlayWindow(config: OverlayWindowConfig): BrowserWindow {
  const { width, height, position } = config
  const { x, y } = resolvePosition(position, width, height)

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false, // never steal focus from the user's app
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    ...config.options
  })

  // Stay above fullscreen apps on all spaces.
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  loadEntry(win, config.htmlEntry)
  return win
}

/** Loads an HTML entry: from the Vite dev server in dev, or from disk in prod. */
export function loadEntry(win: BrowserWindow, htmlEntry: string): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    const base = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, '')
    // Vite serves the entry HTML at /<entry>.html (or / for index.html)
    const path = htmlEntry === 'index.html' ? '' : `/${htmlEntry}`
    win.loadURL(`${base}${path}`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${htmlEntry}`))
  }
}

function resolvePosition(
  pos: OverlayPosition,
  width: number,
  height: number
): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay()
  switch (pos.type) {
    case 'bottom-right':
      return {
        x: workArea.x + workArea.width - width - pos.margin,
        y: workArea.y + workArea.height - height - pos.margin
      }
    case 'center':
      return {
        x: workArea.x + Math.round((workArea.width - width) / 2),
        y: workArea.y + Math.round((workArea.height - height) / 2)
      }
    case 'absolute':
      return { x: pos.x, y: pos.y }
  }
}
