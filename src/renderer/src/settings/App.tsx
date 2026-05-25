import { useEffect, useState } from 'react'
import { LANGUAGE_OPTIONS, type AppSettings, type LanguageCode } from '@shared/settings'
import type { UILanguage } from '@shared/i18n'
import { useI18n } from '../shared/i18n'
import { HotkeyCapture } from './HotkeyCapture'

export function App(): JSX.Element {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [hotkey, setHotkey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [autoStart, setAutoStart] = useState(false)
  const [autoStartSupported, setAutoStartSupported] = useState(false)
  const [language, setLanguage] = useState<LanguageCode>('')
  const [uiLanguage, setUILanguage] = useState<UILanguage>('ja')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    void window.whisper.getSettings().then((s) => {
      applySettings(s)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applySettings(s: AppSettings): void {
    setHotkey(s.hotkey)
    setHasApiKey(s.hasApiKey)
    setAutoStart(s.autoStart)
    setAutoStartSupported(s.autoStartSupported)
    setLanguage(s.language)
    setUILanguage(s.uiLanguage)
  }

  async function onSave(): Promise<void> {
    setSaving(true)
    setMessage(null)
    const update: {
      hotkey?: string
      apiKey?: string | null
      language?: LanguageCode
    } = { hotkey, language }
    if (apiKeyInput.trim()) update.apiKey = apiKeyInput.trim()
    const res = await window.whisper.saveSettings(update)
    setSaving(false)
    if (res.ok) {
      applySettings(res.settings)
      setApiKeyInput('')
      setMessage({ kind: 'ok', text: t('settings.saved') })
    } else {
      setMessage({ kind: 'err', text: res.error ?? t('settings.saveFailed') })
    }
  }

  async function onClearKey(): Promise<void> {
    setSaving(true)
    setMessage(null)
    const res = await window.whisper.saveSettings({ apiKey: null })
    setSaving(false)
    if (res.ok) {
      applySettings(res.settings)
      setMessage({ kind: 'ok', text: t('settings.keyCleared') })
    } else {
      setMessage({ kind: 'err', text: res.error ?? t('settings.clearFailed') })
    }
  }

  // Save autoStart / uiLanguage on toggle (no separate "Save" needed).
  async function onToggleAutoStart(next: boolean): Promise<void> {
    setAutoStart(next)
    setMessage(null)
    const res = await window.whisper.saveSettings({ autoStart: next })
    if (res.ok) {
      applySettings(res.settings)
    } else {
      applySettings(res.settings)
      setMessage({ kind: 'err', text: res.error ?? t('settings.autoStartFailed') })
    }
  }

  async function onChangeUILanguage(next: UILanguage): Promise<void> {
    setUILanguage(next)
    setMessage(null)
    const res = await window.whisper.saveSettings({ uiLanguage: next })
    if (res.ok) {
      applySettings(res.settings)
    } else {
      applySettings(res.settings)
      setMessage({ kind: 'err', text: res.error ?? t('settings.saveFailed') })
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>{t('settings.loading')}</div>
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{t('settings.title')}</h1>

      <Field
        label={t('settings.field.apiKey')}
        help={
          hasApiKey
            ? t('settings.field.apiKey.help.set')
            : t('settings.field.apiKey.help.unset')
        }
      >
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder={
            hasApiKey
              ? t('settings.field.apiKey.placeholder.set')
              : t('settings.field.apiKey.placeholder.unset')
          }
          style={inputStyle}
        />
        {hasApiKey && (
          <button type="button" onClick={onClearKey} disabled={saving} style={linkButtonStyle}>
            {t('settings.field.apiKey.clearButton')}
          </button>
        )}
      </Field>

      <Field label={t('settings.field.hotkey')} help={t('settings.field.hotkey.help')}>
        <HotkeyCapture value={hotkey} onChange={setHotkey} />
      </Field>

      <Field
        label={t('settings.field.language')}
        help={t('settings.field.language.help')}
      >
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          style={selectStyle}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.code === '' ? t('settings.field.language.auto') : opt.label}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? t('settings.saving') : t('settings.saveButton')}
        </button>
        {message && (
          <span style={{ fontSize: 13, color: message.kind === 'ok' ? '#7ee787' : '#ff8080' }}>
            {message.text}
          </span>
        )}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />

      <Field label={t('settings.field.uiLanguage')} help={t('settings.field.uiLanguage.help')}>
        <select
          value={uiLanguage}
          onChange={(e) => void onChangeUILanguage(e.target.value as UILanguage)}
          style={selectStyle}
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </Field>

      <CheckboxField
        label={t('settings.field.autoStart')}
        help={
          autoStartSupported
            ? t('settings.field.autoStart.help.supported')
            : t('settings.field.autoStart.help.unsupported')
        }
        checked={autoStart}
        disabled={!autoStartSupported}
        onChange={onToggleAutoStart}
      />
    </div>
  )
}

function Field({
  label,
  help,
  children
}: {
  label: string
  help?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
      {help && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{help}</span>}
    </label>
  )
}

function CheckboxField({
  label,
  help,
  checked,
  disabled,
  onChange
}: {
  label: string
  help?: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}): JSX.Element {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </span>
      {help && (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', paddingLeft: 24 }}>
          {help}
        </span>
      )}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: '#0f1115',
  color: '#f0f0f0',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
  outline: 'none'
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  paddingRight: 32,
  cursor: 'pointer',
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%23999' stroke-width='1.5'><path d='M1 1l5 5 5-5'/></svg>\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  backgroundSize: '10px'
}

const primaryButtonStyle: React.CSSProperties = {
  background: '#3477f5',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer'
}

const linkButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer'
}
