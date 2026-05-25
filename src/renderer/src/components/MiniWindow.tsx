import { useStatusStore } from '../stores/statusStore'
import { useI18n } from '../shared/i18n'
import type { AppStatus } from '@shared/events'

const COLOR_BY_STATUS: Record<AppStatus, string> = {
  idle: '#444',
  listening: '#e0395d',
  transcribing: '#3477f5',
  pasting: '#9b59b6',
  done: '#2ecc71',
  error: '#c0392b'
}

const STATUS_KEY: Record<AppStatus, Parameters<ReturnType<typeof useI18n>['t']>[0]> = {
  idle: 'status.idle',
  listening: 'status.listening',
  transcribing: 'status.transcribing',
  pasting: 'status.pasting',
  done: 'status.done',
  error: 'status.error'
}

export function MiniWindow(): JSX.Element {
  const status = useStatusStore((s) => s.status)
  const { t } = useI18n()
  const dotColor = COLOR_BY_STATUS[status]

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: '10px 14px',
        background: 'rgba(20, 22, 28, 0.92)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 8px ${dotColor}`,
          flexShrink: 0
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4 }}>
        {t(STATUS_KEY[status])}
      </span>
    </div>
  )
}
