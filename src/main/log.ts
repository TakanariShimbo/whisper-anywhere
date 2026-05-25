/**
 * Tiny timestamped logger for the main process.
 *   [WA 10:34:12.345] hotkey: fired (status=idle)
 *
 * Categories used so far:
 *   hotkey   — global shortcut events (fired/debounced/ignored/registered)
 *   status   — mini-window state transitions
 *   realtime — WebSocket session lifecycle
 *   settings — pause/resume, save
 *   error    — anything routed via console.error
 */

function ts(): string {
  const d = new Date()
  const pad = (n: number, w = 2): string => n.toString().padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

export function log(category: string, msg: string): void {
  console.log(`[WA ${ts()}] ${category}: ${msg}`)
}

export function logError(category: string, msg: string): void {
  console.error(`[WA ${ts()}] ${category}: ${msg}`)
}
