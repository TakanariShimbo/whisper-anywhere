/**
 * Tiny timestamped logger for the main process.
 *   [WA 10:34:12.345] hotkey: fired (status=idle)
 */

export const LogCategory = {
  Hotkey: 'hotkey',
  Status: 'status',
  Realtime: 'realtime',
  Settings: 'settings',
  Notification: 'notification',
  Lifecycle: 'lifecycle'
} as const
export type LogCategory = (typeof LogCategory)[keyof typeof LogCategory]

function ts(): string {
  const d = new Date()
  const pad = (n: number, w = 2): string => n.toString().padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

export function log(category: LogCategory, msg: string): void {
  console.log(`[WA ${ts()}] ${category}: ${msg}`)
}

export function logError(category: LogCategory, msg: string): void {
  console.error(`[WA ${ts()}] ${category}: ${msg}`)
}
