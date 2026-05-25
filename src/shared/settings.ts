/** Settings as exposed to the renderer (apiKey is never sent over IPC in plaintext). */
export interface AppSettings {
  hotkey: string
  hasApiKey: boolean
  /** Whether the OS will launch this app at login. */
  autoStart: boolean
  /** False in dev mode or on unsupported platforms — the UI uses this to disable the toggle. */
  autoStartSupported: boolean
}

/** Updates sent renderer → main. Each field is optional; only present keys are written. */
export interface SettingsUpdate {
  hotkey?: string
  /** plaintext API key; null clears it; undefined leaves it untouched */
  apiKey?: string | null
  /** Toggle OS-level launch-at-login. Ignored when autoStartSupported is false. */
  autoStart?: boolean
}

export interface SettingsSaveResult {
  ok: boolean
  error?: string
  settings: AppSettings
}

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space'
