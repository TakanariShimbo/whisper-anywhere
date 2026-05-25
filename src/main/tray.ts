import { Tray, Menu, nativeImage, app } from 'electron'
import trayIconPath from './assets/tray-mic-white-64.png?asset'

export interface TrayActions {
  openSettings: () => void
  quit: () => void
}

export function createTray(actions: TrayActions): Tray {
  // White mic icon; targets dark Linux trays. The 64px source is cropped tight
  // to the artwork, so it stays visible even when the host tray downscales it.
  const icon = nativeImage.createFromPath(trayIconPath)
  const tray = new Tray(icon)
  tray.setToolTip('WhisperAnywhere')

  const menu = Menu.buildFromTemplate([
    { label: `WhisperAnywhere v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: '設定…', click: actions.openSettings },
    { type: 'separator' },
    { label: '終了', click: actions.quit }
  ])
  tray.setContextMenu(menu)
  return tray
}
