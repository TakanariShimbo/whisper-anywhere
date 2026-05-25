import { Tray, Menu, nativeImage, app } from 'electron'

export interface TrayActions {
  openSettings: () => void
  quit: () => void
}

export function createTray(actions: TrayActions): Tray {
  // 1px transparent placeholder. Replace with a real icon later.
  const icon = nativeImage.createEmpty()
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
