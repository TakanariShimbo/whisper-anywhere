/** Settings as exposed to the renderer (apiKey is never sent over IPC in plaintext). */
export interface AppSettings {
  hotkey: string
  hasApiKey: boolean
}

/** Updates sent renderer → main. Each field is optional; only present keys are written. */
export interface SettingsUpdate {
  hotkey?: string
  /** plaintext API key; null clears it; undefined leaves it untouched */
  apiKey?: string | null
}

export interface SettingsSaveResult {
  ok: boolean
  error?: string
  settings: AppSettings
}

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space'
