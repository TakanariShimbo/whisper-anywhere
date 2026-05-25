import { useEffect, useRef } from 'react'
import { Recorder } from './recorder'

/**
 * Wires the global Recorder to main-process IPC events:
 * - 'recording:start' from main → mic capture begins
 * - 'recording:stop'  from main → mic capture ends, PCM is sent back via
 *                                 whisper.sendRecordingResult / sendRecordingError
 */
export function useRecorder(): void {
  const recorderRef = useRef<Recorder | null>(null)
  if (recorderRef.current === null) recorderRef.current = new Recorder()

  useEffect(() => {
    const recorder = recorderRef.current!

    const offStart = window.whisper.onRecordingStart(() => {
      void recorder.start().catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        window.whisper.sendRecordingError({ message })
      })
    })

    const offStop = window.whisper.onRecordingStop(() => {
      void recorder
        .stop()
        .then((result) => {
          window.whisper.sendRecordingResult(result)
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err)
          window.whisper.sendRecordingError({ message })
        })
    })

    return () => {
      offStart()
      offStop()
    }
  }, [])
}
