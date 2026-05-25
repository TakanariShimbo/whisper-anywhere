import { useEffect } from 'react'
import { MiniWindow } from './components/MiniWindow'
import { useStatusStore } from './stores/statusStore'

export function App(): JSX.Element {
  const setStatus = useStatusStore((s) => s.set)

  useEffect(() => {
    return window.whisper.onStatus(setStatus)
  }, [setStatus])

  return <MiniWindow />
}
