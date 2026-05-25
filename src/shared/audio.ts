/**
 * Audio format used end-to-end: 24 kHz, 16-bit signed little-endian, mono.
 * This matches the Realtime API's `audio/pcm` input format so the renderer
 * can capture directly into the wire format and the main process only has
 * to forward bytes.
 */
export const AUDIO_SAMPLE_RATE = 24000

/** Chunk granularity for streaming PCM from renderer → main → Realtime API. */
export const AUDIO_CHUNK_MS = 40
export const AUDIO_CHUNK_SAMPLES = (AUDIO_SAMPLE_RATE * AUDIO_CHUNK_MS) / 1000 // 960
export const AUDIO_CHUNK_BYTES = AUDIO_CHUNK_SAMPLES * 2 // 1920 (int16 mono)
