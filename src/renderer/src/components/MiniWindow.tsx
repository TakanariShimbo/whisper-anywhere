import { useStatusStore } from '../stores/statusStore'
import type { AppStatus } from '@shared/ipc'

const COLOR_BY_STATUS: Record<AppStatus, string> = {
  idle: '#444',
  listening: '#e0395d',
  transcribing: '#3477f5',
  pasting: '#9b59b6',
  done: '#2ecc71',
  error: '#c0392b'
}

const LABEL_BY_STATUS: Record<AppStatus, string> = {
  idle: '待機中',
  listening: '聞き取り中',
  transcribing: '文字起こし中',
  pasting: '貼り付け中',
  done: '完了',
  error: 'エラー'
}

export function MiniWindow(): JSX.Element {
  const { status, text, error } = useStatusStore()
  const dotColor = COLOR_BY_STATUS[status]

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: '12px 14px',
        background: 'rgba(20, 22, 28, 0.92)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 6
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 8px ${dotColor}`
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4 }}>
          {LABEL_BY_STATUS[status]}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.78)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={error ?? text ?? ''}
      >
        {error ?? text ?? ' '}
      </div>
    </div>
  )
}
