/**
 * Canonical list of every IPC channel used between main / preload / renderer.
 *
 * Convention: `<domain>:<verb>` (e.g. `status:update`, `recording:chunk`).
 * Channel direction is documented in src/shared/events.ts alongside the
 * payload type for that channel.
 */
export const IPC = {
  // main → renderer (status indicator)
  StatusUpdate: 'status:update',
  // main → renderer (transcript panel)
  TranscriptUpdate: 'transcript:update',
  // main → renderer (recorder lifecycle)
  RecordingStart: 'recording:start',
  RecordingStop: 'recording:stop',
  // main → renderer (broadcast when settings save changes anything UI-visible)
  SettingsChanged: 'settings:changed',

  // renderer → main
  RequestQuit: 'app:quit',
  RecordingChunk: 'recording:chunk',
  RecordingError: 'recording:error',

  // renderer → main (request/response — invoked with ipcRenderer.invoke)
  SettingsGet: 'settings:get',
  SettingsSave: 'settings:save',
  HotkeyPause: 'hotkey:pause',
  HotkeyResume: 'hotkey:resume'
} as const
