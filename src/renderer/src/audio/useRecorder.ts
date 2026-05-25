import { useEffect, useRef } from 'react'
import { Recorder } from './recorder'

/**
 * Wires the global Recorder to main-process IPC events:
 * - 'recording:start' from main → mic opens; each worklet-emitted PCM chunk
 *                                 is forwarded via whisper.sendRecordingChunk
 * - 'recording:stop'  from main → mic closes
 *
 * Phase 3: streaming. Each 40ms chunk crosses the IPC boundary as it lands.
 */
export function useRecorder(): void {
  const recorderRef = useRef<Recorder | null>(null)
  if (recorderRef.current === null) recorderRef.current = new Recorder()

  useEffect(() => {
    const recorder = recorderRef.current!

    const offStart = window.whisper.onRecordingStart(() => {
      void recorder
        .start((pcm) => {
          window.whisper.sendRecordingChunk({ pcm })
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err)
          window.whisper.sendRecordingError({ message })
        })
    })

    const offStop = window.whisper.onRecordingStop(() => {
      void recorder.stop().catch((err) => {
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
