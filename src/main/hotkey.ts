import { globalShortcut } from 'electron'

export { DEFAULT_HOTKEY } from '@shared/settings'

export function registerHotkey(accelerator: string, onTrigger: () => void): boolean {
  if (globalShortcut.isRegistered(accelerator)) {
    globalShortcut.unregister(accelerator)
  }
  return globalShortcut.register(accelerator, onTrigger)
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
}
