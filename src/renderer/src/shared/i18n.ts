import { useEffect, useState } from 'react'
import { t as tShared, type UILanguage } from '@shared/i18n'

/**
 * Hook: returns the current UI language and a translator function bound
 * to it. The language is fetched once from settings on mount, then kept
 * in sync via the `onUILanguageChanged` IPC broadcast — saving the
 * setting in any window re-renders every other window without a restart.
 */
export function useI18n(): {
  lang: UILanguage
  t: (key: Parameters<typeof tShared>[0], params?: Record<string, string>) => string
} {
  // Default to 'ja' so first paint matches the most common case here;
  // overwritten as soon as window.whisper.getSettings() resolves.
  const [lang, setLang] = useState<UILanguage>('ja')

  useEffect(() => {
    void window.whisper.getSettings().then((s) => setLang(s.uiLanguage))
    return window.whisper.onUILanguageChanged((next) => setLang(next))
  }, [])

  return {
    lang,
    t: (key, params) => tShared(key, lang, params)
  }
}
