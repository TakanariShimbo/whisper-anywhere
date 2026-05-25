import { Tray, Menu, nativeImage, app } from 'electron'
import trayIconPath from './assets/tray-mic-white-64.png?asset'
import { t } from './i18n'

export interface TrayActions {
  openSettings: () => void
  restart: () => void
  quit: () => void
}

/**
 * Build (or rebuild) the tray context menu using the current UI language.
 * Pass an existing Tray to refresh it in-place after the language changes —
 * the icon and tooltip object are reused; only the menu template is rebuilt.
 */
export function applyTrayMenu(tray: Tray, actions: TrayActions): void {
  const menu = Menu.buildFromTemplate([
    { label: `WhisperAnywhere v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: t('tray.openSettings'), click: actions.openSettings },
    { label: t('tray.restart'), click: actions.restart },
    { type: 'separator' },
    { label: t('tray.quit'), click: actions.quit }
  ])
  tray.setContextMenu(menu)
}

export function createTray(actions: TrayActions): Tray {
  // White mic icon; targets dark Linux trays. The 64px source is cropped tight
  // to the artwork, so it stays visible even when the host tray downscales it.
  const icon = nativeImage.createFromPath(trayIconPath)
  const tray = new Tray(icon)
  tray.setToolTip('WhisperAnywhere')
  applyTrayMenu(tray, actions)
  return tray
}
