/**
 * Payload types for the IPC channels declared in src/shared/channels.ts.
 * Both sides (main + renderer) import from here so the wire format has a
 * single source of truth.
 */

export type AppStatus =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'pasting'
  | 'done'
  | 'error'

/** main → renderer, channel `status:update`. */
export interface StatusPayload {
  status: AppStatus
  text?: string
  error?: string
}

/** main → renderer, channel `transcript:update`. Empty text hides the panel. */
export interface TranscriptPayload {
  text: string
}

/** renderer → main, channel `recording:chunk`. Little-endian int16 mono PCM. */
export interface RecordingChunkPayload {
  pcm: ArrayBuffer
}

/** renderer → main, channel `recording:error`. */
export interface RecordingErrorPayload {
  message: string
}
