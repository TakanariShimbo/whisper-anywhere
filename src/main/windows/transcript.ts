import type { BrowserWindow } from 'electron'
import { TRANSCRIPT_HEIGHT, TRANSCRIPT_WIDTH } from '../constants'
import { createOverlayWindow } from './factory'

/**
 * Live transcript panel, centred on the primary display. Visible only during
 * an active session; updated as partial transcripts arrive from the Realtime
 * API. Auto-scrolls to keep the latest line visible.
 */
export function createTranscriptWindow(): BrowserWindow {
  return createOverlayWindow({
    width: TRANSCRIPT_WIDTH,
    height: TRANSCRIPT_HEIGHT,
    position: { type: 'center' },
    htmlEntry: 'transcript.html'
  })
}
