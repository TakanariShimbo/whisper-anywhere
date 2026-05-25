import { useEffect } from 'react'
import { MiniWindow } from './components/MiniWindow'
import { useStatusStore } from './stores/statusStore'
import { useRecorder } from './audio/useRecorder'

export function App(): JSX.Element {
  const setStatus = useStatusStore((s) => s.set)

  useEffect(() => {
    return window.whisper.onStatus(setStatus)
  }, [setStatus])

  useRecorder()

  return <MiniWindow />
}
