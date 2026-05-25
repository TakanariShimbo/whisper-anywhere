import { clipboard } from 'electron'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { sleep } from './utils/async'

const execAsync = promisify(exec)

type PasteMethod = 'xdotool' | 'osascript' | 'powershell' | 'none'

/**
 * Copy text to clipboard, then simulate paste into the currently focused window.
 *
 * Linux (X11): uses `xdotool key --clearmodifiers ctrl+v`.
 * macOS:       uses AppleScript `keystroke "v" using command down`.
 * Windows:     uses PowerShell `[System.Windows.Forms.SendKeys]::SendWait('^v')`.
 *
 * Returns the method used. 'none' means the text was copied but paste was skipped.
 */
export async function copyAndPaste(text: string): Promise<PasteMethod> {
  clipboard.writeText(text)
  // Tiny delay so the clipboard write is visible to the target app before
  // we synthesize the paste keystroke.
  await sleep(40)

  if (process.platform === 'linux') {
    await execAsync('xdotool key --clearmodifiers ctrl+v')
    return 'xdotool'
  }

  if (process.platform === 'darwin') {
    await execAsync(
      `osascript -e 'tell application "System Events" to keystroke "v" using command down'`
    )
    return 'osascript'
  }

  if (process.platform === 'win32') {
    // SendKeys ^v == Ctrl+V. We add a small WScript.Sleep so the target app
    // can finish processing focus changes before the keystroke arrives.
    await execAsync(
      'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; ' +
        "Start-Sleep -Milliseconds 30; " +
        "[System.Windows.Forms.SendKeys]::SendWait('^v')\""
    )
    return 'powershell'
  }

  return 'none'
}
