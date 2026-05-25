import type { WhisperApi } from '../../preload/index'

declare global {
  interface Window {
    whisper: WhisperApi
  }
}

export {}
