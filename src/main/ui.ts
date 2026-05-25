import { BrowserWindow, Notification } from 'electron'
import appIconPath from './assets/app-icon-256.png?asset'
import { IPC } from '@shared/channels'
import type { StatusPayload, TranscriptPayload } from '@shared/events'
import { t } from './i18n'
import { LogCategory, log, logError } from './log'
import { state } from './state/appState'
import { isAllowedTransition } from './state/transitions'
import { truncate } from './utils/string'

/**
 * Owns every "what does the user see right now" concern:
 *   - the status indicator window (mini)
 *   - the live transcript window
 *   - OS-level error notifications
 *
 * Window references are injected once at bootstrap via setWindows() so this
 * module stays callable from any layer (session, ipc handlers) without
 * threading window handles through every call site.
 */

let miniWindow: BrowserWindow | null = null
let transcriptWindow: BrowserWindow | null = null

export function setWindows(mini: BrowserWindow, transcript: BrowserWindow): void {
  miniWindow = mini
  transcriptWindow = transcript
}

/** Update the status indicator. Logs the transition; warns if illegal. */
export function setStatus(payload: StatusPayload): void {
  const prev = state.status
  if (!isAllowedTransition(prev, payload.status)) {
    logError(LogCategory.Status, `ILLEGAL transition ${prev} → ${payload.status} (allowing)`)
  }
  state.setStatus(payload.status)
  if (prev !== payload.status) {
    const detail = payload.error
      ? ` error="${truncate(payload.error)}"`
      : payload.text
        ? ` "${truncate(payload.text)}"`
        : ''
    log(LogCategory.Status, `${prev} → ${payload.status}${detail}`)
  }
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send(IPC.StatusUpdate, payload)
    if (payload.status === 'idle') {
      miniWindow.hide()
    } else if (!miniWindow.isVisible()) {
      miniWindow.showInactive() // show without stealing focus
    }
  }
  // Transcript window follows the same visibility rule as the indicator:
  // visible during an active session, hidden when we're idle.
  if (payload.status === 'idle') {
    setTranscript('')
    hideTranscript()
  }
  // Surface error details via a native OS notification so the user can read
  // them at leisure — the mini window itself only shows a status label.
  if (prev !== 'error' && payload.status === 'error' && payload.error) {
    showErrorNotification(payload.error)
  }
}

/**
 * Update the live transcript panel's text. Window visibility is controlled
 * separately via showTranscript / hideTranscript — empty text keeps the
 * window visible so the placeholder (rendered by the React component when
 * text is empty) acts as the "no speech yet" state.
 */
export function setTranscript(text: string): void {
  if (!transcriptWindow || transcriptWindow.isDestroyed()) return
  const payload: TranscriptPayload = { text }
  transcriptWindow.webContents.send(IPC.TranscriptUpdate, payload)
}

export function showTranscript(): void {
  if (!transcriptWindow || transcriptWindow.isDestroyed()) return
  if (!transcriptWindow.isVisible()) transcriptWindow.showInactive()
}

export function hideTranscript(): void {
  if (!transcriptWindow || transcriptWindow.isDestroyed()) return
  if (transcriptWindow.isVisible()) transcriptWindow.hide()
}

/** Show a native OS notification with critical urgency (won't auto-dismiss). */
export function showErrorNotification(message: string): void {
  if (!Notification.isSupported()) {
    log(LogCategory.Notification, `(unsupported) ${message}`)
    return
  }
  try {
    new Notification({
      title: t('notification.errorTitle'),
      body: message,
      icon: appIconPath,
      urgency: 'critical'
    }).show()
  } catch (err) {
    logError(
      LogCategory.Notification,
      `failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/** Push the current status to the mini window (used after did-finish-load). */
export function emitInitialStatus(): void {
  if (!miniWindow || miniWindow.isDestroyed()) return
  miniWindow.webContents.send(IPC.StatusUpdate, {
    status: state.status
  } satisfies StatusPayload)
}
