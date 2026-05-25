/**
 * Magic numbers used across the main process. Collected here so behavioural
 * tuning happens in one place.
 */

/** How long the indicator holds "done" / "error" before fading to idle. */
export const HIDE_DELAY_MS = 2500

/** How long the indicator holds the "error" state specifically (overrides HIDE_DELAY_MS). */
export const ERROR_HIDE_DELAY_MS = 6000

/** Minimum gap between hotkey fires; defends against OS-level double dispatch. */
export const HOTKEY_COOLDOWN_MS = 300

/**
 * Hold for transient errors that auto-clear (e.g. missing API key, mic
 * permission denied). Shorter than ERROR_HIDE_DELAY_MS because we also
 * surface these via a native notification.
 */
export const TRANSIENT_ERROR_HIDE_MS = 3000

/** Mini status indicator window dimensions (pixels). */
export const MINI_WIDTH = 200
export const MINI_HEIGHT = 48

/** Live transcript panel window dimensions (pixels). */
export const TRANSCRIPT_WIDTH = 600
export const TRANSCRIPT_HEIGHT = 160

/** Settings window default dimensions (pixels). */
export const SETTINGS_WIDTH = 520
export const SETTINGS_HEIGHT = 660

/** Margin from the screen edge for overlay windows (pixels). */
export const OVERLAY_MARGIN = 24

/** Realtime API: max audio chunks buffered while waiting for session.ready. */
export const REALTIME_PRE_BUFFER_MAX = 250

/** Realtime API: grace period after stop() before forcing the WS closed. */
export const REALTIME_COMMIT_WAIT_MS = 4000
