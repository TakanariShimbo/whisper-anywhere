import { t as tShared, type UILanguage } from '@shared/i18n'
import { LogCategory, log } from './log'

/**
 * Main-process side of the i18n module. Holds the current UI language in
 * memory so any layer (status / tray / notifications / error messages)
 * can translate without needing to re-read settings on every call.
 *
 * Initialised once at bootstrap via setCurrentUILanguage() and updated
 * whenever the user saves the settings.
 */
let currentLang: UILanguage = 'ja'

export function getCurrentUILanguage(): UILanguage {
  return currentLang
}

export function setCurrentUILanguage(lang: UILanguage): void {
  if (currentLang !== lang) {
    log(LogCategory.Settings, `uiLanguage: ${currentLang} → ${lang}`)
  }
  currentLang = lang
}

/** Translate `key` using the current main-process UI language. */
export function t(key: Parameters<typeof tShared>[0], params?: Record<string, string>): string {
  return tShared(key, currentLang, params)
}
