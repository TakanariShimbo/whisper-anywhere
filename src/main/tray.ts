import { Tray, Menu, nativeImage, app } from 'electron'

export function createTray(onQuit: () => void): Tray {
  // 1px transparent placeholder. Replace with a real icon later.
  const icon = nativeImage.createEmpty()
  const tray = new Tray(icon)
  tray.setToolTip('WhisperAnywhere')

  const menu = Menu.buildFromTemplate([
    { label: `WhisperAnywhere v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: '終了', click: onQuit }
  ])
  tray.setContextMenu(menu)
  return tray
}
