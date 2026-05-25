import { app, ipcMain } from 'electron'
import { IPC } from '@shared/channels'
import type {
  RecordingChunkPayload,
  RecordingErrorPayload
} from '@shared/events'
import type { SettingsSaveResult, SettingsUpdate } from '@shared/settings'
import { LogCategory, log, logError } from './log'
import {
  applyHotkey,
  handleRecordingChunk,
  handleRecordingError,
  pauseHotkey,
  resumeHotkey
} from './session'
import { applyAutoStart, getAutoStartStatus } from './services/autoStart'
import { getAppSettings, updateSettings } from './settings'
import { state } from './state/appState'

async function getCombinedSettings() {
  const [base, auto] = await Promise.all([getAppSettings(), getAutoStartStatus()])
  return { ...base, autoStart: auto.enabled, autoStartSupported: auto.supported }
}

/**
 * One-stop registration of every IPC handler. Called once at bootstrap.
 *
 * Channels are documented in src/shared/channels.ts; payload shapes in
 * src/shared/events.ts. Handlers delegate to the relevant feature module
 * (session, settings, ui) — this file is mostly a wiring sheet.
 */
export function registerIpcHandlers(): void {
  ipcMain.on(IPC.RequestQuit, () => app.quit())

  ipcMain.on(IPC.RecordingChunk, (_e, payload: RecordingChunkPayload) => {
    handleRecordingChunk(payload.pcm)
  })

  ipcMain.on(IPC.RecordingError, (_e, payload: RecordingErrorPayload) => {
    handleRecordingError(payload.message)
  })

  ipcMain.handle(IPC.HotkeyPause, () => pauseHotkey())
  ipcMain.handle(IPC.HotkeyResume, () => resumeHotkey())

  ipcMain.handle(IPC.SettingsGet, () => getCombinedSettings())
  ipcMain.handle(
    IPC.SettingsSave,
    async (_e, update: SettingsUpdate): Promise<SettingsSaveResult> => {
      log(
        LogCategory.Settings,
        `save: ${update.hotkey ? `hotkey=${update.hotkey} ` : ''}${
          update.apiKey === null
            ? 'apiKey=null '
            : update.apiKey !== undefined
              ? 'apiKey=*** '
              : ''
        }${update.autoStart !== undefined ? `autoStart=${update.autoStart} ` : ''}`.trim() ||
          'save: (no changes)'
      )
      try {
        const previousHotkey = state.hotkeyAccel
        await updateSettings(update)
        const settings = await getCombinedSettings()
        if (settings.hotkey !== previousHotkey) {
          const ok = await applyHotkey(settings.hotkey)
          if (!ok) {
            // Re-register the previous one so the app stays usable.
            await applyHotkey(previousHotkey)
            return {
              ok: false,
              error: `ホットキー登録失敗: ${settings.hotkey}`,
              settings: await getCombinedSettings()
            }
          }
        }
        if (update.autoStart !== undefined) {
          await applyAutoStart(update.autoStart)
        }
        return { ok: true, settings: await getCombinedSettings() }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logError(LogCategory.Settings, `save failed: ${message}`)
        return { ok: false, error: message, settings: await getCombinedSettings() }
      }
    }
  )
}
