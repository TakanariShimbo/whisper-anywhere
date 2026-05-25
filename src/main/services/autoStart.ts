import { app } from 'electron'
import { mkdir, access, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { LogCategory, log, logError } from '../log'

/**
 * OS-level "launch at login" abstraction.
 *
 * - macOS / Windows: delegates to `app.setLoginItemSettings()` which writes
 *   to the OS's login items / registry Run key respectively.
 * - Linux: writes a freedesktop.org autostart entry at
 *   `~/.config/autostart/whisper-anywhere.desktop` pointing to the running
 *   executable (`process.execPath`, which resolves to the AppImage binary
 *   or the .deb-installed binary in packaged builds).
 *
 * No-ops in dev mode (`!app.isPackaged`) because the dev executable is the
 * Electron CLI inside node_modules — auto-starting it would do nothing
 * useful and surprises the developer on next boot.
 */

const LINUX_AUTOSTART_FILE = join(
  homedir(),
  '.config',
  'autostart',
  'whisper-anywhere.desktop'
)

export interface AutoStartStatus {
  /** False in dev mode or on platforms we don't handle. */
  supported: boolean
  /** Whether the OS will launch this app at login right now. */
  enabled: boolean
}

export async function getAutoStartStatus(): Promise<AutoStartStatus> {
  if (!app.isPackaged) {
    return { supported: false, enabled: false }
  }

  if (process.platform === 'darwin' || process.platform === 'win32') {
    return { supported: true, enabled: app.getLoginItemSettings().openAtLogin }
  }

  if (process.platform === 'linux') {
    return { supported: true, enabled: await fileExists(LINUX_AUTOSTART_FILE) }
  }

  return { supported: false, enabled: false }
}

export async function applyAutoStart(enabled: boolean): Promise<void> {
  if (!app.isPackaged) {
    log(LogCategory.Lifecycle, `autoStart skipped (dev mode): wanted=${enabled}`)
    return
  }

  try {
    if (process.platform === 'darwin' || process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        // On macOS, hide the app at login so the user just sees the tray icon.
        ...(process.platform === 'darwin' ? { openAsHidden: true } : {})
      })
      log(LogCategory.Lifecycle, `autoStart=${enabled} via setLoginItemSettings`)
      return
    }

    if (process.platform === 'linux') {
      if (enabled) {
        await mkdir(dirname(LINUX_AUTOSTART_FILE), { recursive: true })
        await writeFile(LINUX_AUTOSTART_FILE, buildLinuxDesktopEntry(), 'utf-8')
        log(LogCategory.Lifecycle, `autoStart=true wrote ${LINUX_AUTOSTART_FILE}`)
      } else {
        try {
          await unlink(LINUX_AUTOSTART_FILE)
          log(LogCategory.Lifecycle, `autoStart=false removed ${LINUX_AUTOSTART_FILE}`)
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
        }
      }
      return
    }
  } catch (err) {
    logError(
      LogCategory.Lifecycle,
      `autoStart apply failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

function buildLinuxDesktopEntry(): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=WhisperAnywhere',
    `Exec=${process.execPath}`,
    'X-GNOME-Autostart-enabled=true',
    'NoDisplay=false',
    'Terminal=false',
    ''
  ].join('\n')
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
