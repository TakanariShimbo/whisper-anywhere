import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type StatusPayload,
  type RecordingChunkPayload,
  type RecordingErrorPayload
} from '@shared/ipc'

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
  quit(): void {
    ipcRenderer.send(IPC.RequestQuit)
  }
}

contextBridge.exposeInMainWorld('whisper', api)

export type WhisperApi = typeof api
