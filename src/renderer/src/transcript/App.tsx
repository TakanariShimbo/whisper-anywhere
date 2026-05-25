import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function App(): JSX.Element {
  const [text, setText] = useState('')
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return window.whisper.onTranscript(({ text }) => setText(text))
  }, [])

  // Stick the view to the bottom on every text update so the latest line
  // is always visible no matter how long the transcript grows.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: '14px 20px',
        background: 'rgba(20, 22, 28, 0.92)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 10px 32px rgba(0,0,0,0.45)',
        display: 'flex'
      }}
    >
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          fontSize: 18,
          lineHeight: 1.45,
          color: text ? '#f5f5f5' : 'rgba(255,255,255,0.4)',
          wordBreak: 'break-word',
          textAlign: 'left',
          // Hide the scrollbar — the window is non-interactive (focusable:false)
          // and the auto-scroll keeps the latest content in view.
          scrollbarWidth: 'none'
        }}
      >
        {text || '話してください…'}
      </div>
    </div>
  )
}
