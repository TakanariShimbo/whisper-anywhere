import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/settings'
import { HotkeyCapture } from './HotkeyCapture'

const HELP_HOTKEY = '「変更」ボタンを押してから設定したいキーの組み合わせを実際に押してください'

export function App(): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [hotkey, setHotkey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [autoStart, setAutoStart] = useState(false)
  const [autoStartSupported, setAutoStartSupported] = useState(false)
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
  }

  async function onSave(): Promise<void> {
    setSaving(true)
    setMessage(null)
    const update: { hotkey?: string; apiKey?: string | null } = { hotkey }
    if (apiKeyInput.trim()) update.apiKey = apiKeyInput.trim()
    const res = await window.whisper.saveSettings(update)
    setSaving(false)
    if (res.ok) {
      applySettings(res.settings)
      setApiKeyInput('')
      setMessage({ kind: 'ok', text: '保存しました' })
    } else {
      setMessage({ kind: 'err', text: res.error ?? '保存に失敗しました' })
    }
  }

  async function onClearKey(): Promise<void> {
    setSaving(true)
    setMessage(null)
    const res = await window.whisper.saveSettings({ apiKey: null })
    setSaving(false)
    if (res.ok) {
      applySettings(res.settings)
      setMessage({ kind: 'ok', text: 'API キーを削除しました' })
    } else {
      setMessage({ kind: 'err', text: res.error ?? '削除に失敗しました' })
    }
  }

  // Save autoStart on toggle (no separate "保存" needed for a single boolean).
  async function onToggleAutoStart(next: boolean): Promise<void> {
    setAutoStart(next) // optimistic
    setMessage(null)
    const res = await window.whisper.saveSettings({ autoStart: next })
    if (res.ok) {
      applySettings(res.settings)
    } else {
      applySettings(res.settings) // revert
      setMessage({ kind: 'err', text: res.error ?? '自動起動の設定に失敗しました' })
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>読み込み中…</div>
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>WhisperAnywhere 設定</h1>

      <Field
        label="OpenAI API キー"
        help={hasApiKey ? '設定済み（空欄のまま保存すれば変更なし）' : '未設定'}
      >
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder={hasApiKey ? '••••••••（変更時のみ入力）' : 'sk-…'}
          style={inputStyle}
        />
        {hasApiKey && (
          <button type="button" onClick={onClearKey} disabled={saving} style={linkButtonStyle}>
            キーを削除
          </button>
        )}
      </Field>

      <Field label="ホットキー" help={HELP_HOTKEY}>
        <HotkeyCapture value={hotkey} onChange={setHotkey} />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? '保存中…' : '保存'}
        </button>
        {message && (
          <span style={{ fontSize: 13, color: message.kind === 'ok' ? '#7ee787' : '#ff8080' }}>
            {message.text}
          </span>
        )}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />

      <CheckboxField
        label="ログイン時に起動"
        help={
          autoStartSupported
            ? 'OS にサインインしたとき自動で WhisperAnywhere を立ち上げます'
            : '開発モードでは無効（インストール版でのみ動作）'
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
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', paddingLeft: 24 }}>{help}</span>
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
