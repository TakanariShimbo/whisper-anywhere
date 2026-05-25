export const IPC = {
  StatusUpdate: 'status:update',
  TranscriptUpdate: 'transcript:update',
  RequestQuit: 'app:quit',
  RecordingStart: 'recording:start',
  RecordingStop: 'recording:stop',
  RecordingChunk: 'recording:chunk',
  RecordingError: 'recording:error',
  SettingsGet: 'settings:get',
  SettingsSave: 'settings:save',
  HotkeyPause: 'hotkey:pause',
  HotkeyResume: 'hotkey:resume'
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
export const AUDIO_CHUNK_MS = 40
export const AUDIO_CHUNK_SAMPLES = (AUDIO_SAMPLE_RATE * AUDIO_CHUNK_MS) / 1000 // 960
export const AUDIO_CHUNK_BYTES = AUDIO_CHUNK_SAMPLES * 2 // 1920 bytes (int16 mono)

/** Sent renderer → main for each ~40ms PCM chunk. Little-endian int16 mono. */
export interface RecordingChunkPayload {
  pcm: ArrayBuffer
}

export interface RecordingErrorPayload {
  message: string
}

/** Current live transcript text. Empty string means clear / hide. */
export interface TranscriptPayload {
  text: string
}
