import { globalShortcut } from 'electron'

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space'

export function registerHotkey(accelerator: string, onTrigger: () => void): boolean {
  if (globalShortcut.isRegistered(accelerator)) {
    globalShortcut.unregister(accelerator)
  }
  return globalShortcut.register(accelerator, onTrigger)
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
}
