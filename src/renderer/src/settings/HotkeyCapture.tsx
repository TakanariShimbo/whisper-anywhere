import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../shared/i18n'

interface Props {
  value: string
  onChange: (accelerator: string) => void
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'])

/**
 * Build an Electron accelerator string from a KeyboardEvent.
 * Returns null when the event is modifier-only (no trigger key yet).
 * https://www.electronjs.org/docs/latest/api/accelerator
 */
function buildAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  if (MODIFIER_KEYS.has(e.key)) return null

  const key = mapCode(e.code, e.key)
  if (!key) return null
  parts.push(key)
  return parts.join('+')
}

/** Render the current modifier set for live feedback while recording. */
function buildPreview(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  return parts.length ? parts.join('+') + '+ …' : '…'
}

function mapCode(code: string, key: string): string | null {
  // Letters: KeyA…KeyZ → A…Z
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  // Digits: Digit0…Digit9 → 0…9
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  // Function keys: F1…F24
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code

  const special: Record<string, string> = {
    Space: 'Space',
    Enter: 'Return',
    NumpadEnter: 'Return',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Escape: 'Escape',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    PrintScreen: 'PrintScreen',
    CapsLock: 'Capslock',
    NumLock: 'Numlock',
    ScrollLock: 'Scrolllock',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`'
  }
  if (special[code]) return special[code]

  if (code.startsWith('Numpad')) {
    const rest = code.slice(6)
    if (/^\d$/.test(rest)) return `num${rest}`
    const numpadMap: Record<string, string> = {
      Add: 'numadd',
      Subtract: 'numsub',
      Multiply: 'nummult',
      Divide: 'numdiv',
      Decimal: 'numdec'
    }
    if (numpadMap[rest]) return numpadMap[rest]
  }

  // Last-resort: single printable character (e.g. unrecognized punctuation)
  if (key.length === 1) return key.toUpperCase()
  return null
}

export function HotkeyCapture({ value, onChange }: Props): JSX.Element {
  const { t } = useI18n()
  const [recording, setRecording] = useState(false)
  const [preview, setPreview] = useState('')

  const startRecording = useCallback(async () => {
    await window.whisper.pauseHotkey()
    setPreview('')
    setRecording(true)
  }, [])

  const stopRecording = useCallback(async () => {
    setRecording(false)
    setPreview('')
    await window.whisper.resumeHotkey()
  }, [])

  useEffect(() => {
    if (!recording) return

    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        void stopRecording()
        return
      }

      const accel = buildAccelerator(e)
      if (accel) {
        onChange(accel)
        void stopRecording()
      } else {
        setPreview(buildPreview(e))
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording, onChange, stopRecording])

  // Safety: if the component unmounts mid-recording, resume the global hotkey.
  useEffect(() => {
    return () => {
      if (recording) void window.whisper.resumeHotkey()
    }
  }, [recording])

  return (
    <>
      <div
        style={{
          flex: 1,
          background: recording ? '#3477f5' : '#0f1115',
          color: recording ? '#fff' : '#f0f0f0',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 13,
          fontFamily: recording
            ? 'inherit'
            : 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          minHeight: 19,
          letterSpacing: 0.2
        }}
      >
        {recording
          ? preview || t('settings.field.hotkey.prompt')
          : value || t('settings.field.hotkey.empty')}
      </div>
      {recording ? (
        <button type="button" onClick={() => void stopRecording()} style={cancelButtonStyle}>
          {t('settings.field.hotkey.cancelButton')}
        </button>
      ) : (
        <button type="button" onClick={() => void startRecording()} style={recordButtonStyle}>
          {t('settings.field.hotkey.recordButton')}
        </button>
      )}
    </>
  )
}

const recordButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#f0f0f0',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
}

const cancelButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
}
