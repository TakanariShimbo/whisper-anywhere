export const IPC = {
  StatusUpdate: 'status:update',
  RequestQuit: 'app:quit',
  RecordingStart: 'recording:start',
  RecordingStop: 'recording:stop',
  RecordingResult: 'recording:result',
  RecordingError: 'recording:error'
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

export const AUDIO_SAMPLE_RATE = 24000

/** Sent renderer → main when recording finishes. PCM is little-endian int16 mono. */
export interface RecordingResultPayload {
  pcm: ArrayBuffer
  sampleRate: number
  durationMs: number
}

export interface RecordingErrorPayload {
  message: string
}
