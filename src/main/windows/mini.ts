import type { BrowserWindow } from 'electron'
import appIconPath from '../assets/app-icon-256.png?asset'
import { MINI_HEIGHT, MINI_WIDTH, OVERLAY_MARGIN } from '../constants'
import { createOverlayWindow } from './factory'

/**
 * Slim status indicator anchored to the bottom-right of the primary display.
 * Shows just a coloured dot + state label; transcript text and error detail
 * live in their own surfaces (transcript window / OS notification).
 */
export function createMiniWindow(): BrowserWindow {
  return createOverlayWindow({
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    position: { type: 'bottom-right', margin: OVERLAY_MARGIN },
    htmlEntry: 'index.html',
    options: { icon: appIconPath }
  })
}
