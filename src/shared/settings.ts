/** Settings as exposed to the renderer (apiKey is never sent over IPC in plaintext). */
export interface AppSettings {
  hotkey: string
  hasApiKey: boolean
  /** Whether the OS will launch this app at login. */
  autoStart: boolean
  /** False in dev mode or on unsupported platforms — the UI uses this to disable the toggle. */
  autoStartSupported: boolean
  /** ISO-639-1 code passed to the Realtime API as a transcription hint. Empty string = auto-detect. */
  language: LanguageCode
  /** Language used by WhisperAnywhere's own UI (settings, indicator labels, tray menu, notifications). */
  uiLanguage: 'ja' | 'en'
}

/** Updates sent renderer → main. Each field is optional; only present keys are written. */
export interface SettingsUpdate {
  hotkey?: string
  /** plaintext API key; null clears it; undefined leaves it untouched */
  apiKey?: string | null
  /** Toggle OS-level launch-at-login. Ignored when autoStartSupported is false. */
  autoStart?: boolean
  /** ISO-639-1 transcription language hint. '' means auto-detect. */
  language?: LanguageCode
  /** Toggle the app's UI language. */
  uiLanguage?: 'ja' | 'en'
}

/**
 * Supported transcription language hints. '' = auto-detect (default).
 * Whisper supports ~99 languages; this list covers the most common ones —
 * extend as needed.
 */
export type LanguageCode =
  | ''
  | 'ja'
  | 'en'
  | 'zh'
  | 'ko'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'ru'

export interface LanguageOption {
  code: LanguageCode
  label: string
}

/** Source of truth for the dropdown order and labels in the settings UI. */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: '', label: '自動検出 (Auto)' },
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' }
]

export interface SettingsSaveResult {
  ok: boolean
  error?: string
  settings: AppSettings
}

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space'
