import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type StatusPayload,
  type RecordingChunkPayload,
  type RecordingErrorPayload
} from '@shared/ipc'
import type { AppSettings, SettingsSaveResult, SettingsUpdate } from '@shared/settings'

const api = {
  onStatus(callback: (payload: StatusPayload) => void): () => void {
    const listener = (_: Electron.IpcRendererEvent, payload: StatusPayload) =>
      callback(payload)
    ipcRenderer.on(IPC.StatusUpdate, listener)
    return () => ipcRenderer.off(IPC.StatusUpdate, listener)
  },
  onRecordingStart(callback: () => void): () => void {
    const listener = () => callback()
    ipcRenderer.on(IPC.RecordingStart, listener)
    return () => ipcRenderer.off(IPC.RecordingStart, listener)
  },
  onRecordingStop(callback: () => void): () => void {
    const listener = () => callback()
    ipcRenderer.on(IPC.RecordingStop, listener)
    return () => ipcRenderer.off(IPC.RecordingStop, listener)
  },
  sendRecordingChunk(payload: RecordingChunkPayload): void {
    ipcRenderer.send(IPC.RecordingChunk, payload)
  },
  sendRecordingError(payload: RecordingErrorPayload): void {
    ipcRenderer.send(IPC.RecordingError, payload)
  },
  getSettings(): Promise<AppSettings> {
    return ipcRenderer.invoke(IPC.SettingsGet)
  },
  saveSettings(update: SettingsUpdate): Promise<SettingsSaveResult> {
    return ipcRenderer.invoke(IPC.SettingsSave, update)
  },
  quit(): void {
    ipcRenderer.send(IPC.RequestQuit)
  }
}

contextBridge.exposeInMainWorld('whisper', api)

export type WhisperApi = typeof api
