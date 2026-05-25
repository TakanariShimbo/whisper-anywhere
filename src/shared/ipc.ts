export const IPC = {
  StatusUpdate: 'status:update',
  RequestQuit: 'app:quit'
} as const

export type AppStatus =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'pasting'
  | 'done'
  | 'error'

export interface StatusPayload {
  status: AppStatus
  text?: string
  error?: string
}
