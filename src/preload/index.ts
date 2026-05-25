import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/channels'
import type {
  StatusPayload,
  RecordingChunkPayload,
  RecordingErrorPayload,
  TranscriptPayload
} from '@shared/events'
import type { AppSettings, SettingsSaveResult, SettingsUpdate } from '@shared/settings'

/**
 * Subscribe to a main → renderer IPC event. The optional Payload type
 * parameter lets the caller bind a payload shape without hand-writing the
 * listener wrapper each time.
 */
function on<Payload = void>(
  channel: string,
  callback: (payload: Payload) => void
): () => void {
  const listener = (_: Electron.IpcRendererEvent, payload: Payload): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

const api = {
  onStatus: (cb: (p: StatusPayload) => void) => on<StatusPayload>(IPC.StatusUpdate, cb),
  onTranscript: (cb: (p: TranscriptPayload) => void) => on<TranscriptPayload>(IPC.TranscriptUpdate, cb),
  onRecordingStart: (cb: () => void) => on(IPC.RecordingStart, cb),
  onRecordingStop: (cb: () => void) => on(IPC.RecordingStop, cb),

  sendRecordingChunk: (payload: RecordingChunkPayload): void =>
    ipcRenderer.send(IPC.RecordingChunk, payload),
  sendRecordingError: (payload: RecordingErrorPayload): void =>
    ipcRenderer.send(IPC.RecordingError, payload),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SettingsGet),
  saveSettings: (update: SettingsUpdate): Promise<SettingsSaveResult> =>
    ipcRenderer.invoke(IPC.SettingsSave, update),

  pauseHotkey: (): Promise<void> => ipcRenderer.invoke(IPC.HotkeyPause),
  resumeHotkey: (): Promise<void> => ipcRenderer.invoke(IPC.HotkeyResume),

  quit: (): void => ipcRenderer.send(IPC.RequestQuit)
}

contextBridge.exposeInMainWorld('whisper', api)

export type WhisperApi = typeof api
