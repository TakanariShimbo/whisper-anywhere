import { clipboard } from 'electron'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Copy text to clipboard, then simulate paste into the currently focused window.
 *
 * Linux (X11): uses `xdotool key --clearmodifiers ctrl+v`.
 * macOS:       uses AppleScript `keystroke "v" using command down`.
 * Windows:     not implemented yet (Phase 1 dev env is Linux).
 *
 * Returns the method used, or throws if no paste mechanism is available.
 */
export async function copyAndPaste(text: string): Promise<'xdotool' | 'osascript' | 'none'> {
  clipboard.writeText(text)

  if (process.platform === 'linux') {
    // Tiny delay so the clipboard write is visible to xdotool's target app.
    await sleep(40)
    await execAsync('xdotool key --clearmodifiers ctrl+v')
    return 'xdotool'
  }

  if (process.platform === 'darwin') {
    await sleep(40)
    await execAsync(
      `osascript -e 'tell application "System Events" to keystroke "v" using command down'`
    )
    return 'osascript'
  }

  // Windows: TODO via PowerShell SendKeys or nut-tree. For now just leave on clipboard.
  return 'none'
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
