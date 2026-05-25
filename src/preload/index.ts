import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type StatusPayload } from '@shared/ipc'

const api = {
  onStatus(callback: (payload: StatusPayload) => void): () => void {
    const listener = (_: Electron.IpcRendererEvent, payload: StatusPayload) =>
      callback(payload)
    ipcRenderer.on(IPC.StatusUpdate, listener)
    return () => ipcRenderer.off(IPC.StatusUpdate, listener)
  },
  quit(): void {
    ipcRenderer.send(IPC.RequestQuit)
  }
}

contextBridge.exposeInMainWorld('whisper', api)

export type WhisperApi = typeof api
