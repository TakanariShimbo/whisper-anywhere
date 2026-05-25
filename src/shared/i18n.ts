/**
 * Tiny i18n table for UI strings (settings labels, status labels, tray menu,
 * error notifications). Logs and debug output stay in their native form.
 *
 * Adding a key:
 *   1. Add the entry to BOTH `ja` and `en` blocks below
 *   2. Reference via `t(key, lang)` — TypeScript enforces the key set
 *   3. Use `{param}` placeholders for runtime interpolation
 */

export type UILanguage = 'ja' | 'en'

interface Strings {
  // settings window
  'settings.title': string
  'settings.loading': string
  'settings.field.apiKey': string
  'settings.field.apiKey.help.set': string
  'settings.field.apiKey.help.unset': string
  'settings.field.apiKey.placeholder.set': string
  'settings.field.apiKey.placeholder.unset': string
  'settings.field.apiKey.clearButton': string
  'settings.field.hotkey': string
  'settings.field.hotkey.help': string
  'settings.field.hotkey.recordButton': string
  'settings.field.hotkey.cancelButton': string
  'settings.field.hotkey.prompt': string
  'settings.field.hotkey.empty': string
  'settings.field.language': string
  'settings.field.language.help': string
  'settings.field.language.auto': string
  'settings.field.uiLanguage': string
  'settings.field.uiLanguage.help': string
  'settings.field.autoStart': string
  'settings.field.autoStart.help.supported': string
  'settings.field.autoStart.help.unsupported': string
  'settings.saveButton': string
  'settings.saving': string
  'settings.saved': string
  'settings.saveFailed': string
  'settings.clearFailed': string
  'settings.keyCleared': string
  'settings.autoStartFailed': string

  // mini indicator status labels
  'status.idle': string
  'status.listening': string
  'status.transcribing': string
  'status.pasting': string
  'status.done': string
  'status.error': string

  // status payload text (sent from main, displayed by mini — but mini ignores
  // these for the label area; reserved for future use)
  'status.text.listening': string
  'status.text.finalizing': string
  'status.text.noTranscript': string
  'status.text.copyOnly': string

  // transcript panel
  'transcript.placeholder': string

  // tray menu
  'tray.openSettings': string
  'tray.restart': string
  'tray.quit': string

  // OS notifications
  'notification.errorTitle': string

  // error messages
  'error.noApiKey': string
  'error.hotkeyRegisterFailed': string
  'error.pasteFailed': string
}

type TKey = keyof Strings

const ja: Strings = {
  'settings.title': 'WhisperAnywhere 設定',
  'settings.loading': '読み込み中…',
  'settings.field.apiKey': 'OpenAI API キー',
  'settings.field.apiKey.help.set': '設定済み（空欄のまま保存すれば変更なし）',
  'settings.field.apiKey.help.unset': '未設定',
  'settings.field.apiKey.placeholder.set': '••••••••（変更時のみ入力）',
  'settings.field.apiKey.placeholder.unset': 'sk-…',
  'settings.field.apiKey.clearButton': 'キーを削除',
  'settings.field.hotkey': 'ホットキー',
  'settings.field.hotkey.help':
    '「変更」ボタンを押してから設定したいキーの組み合わせを実際に押してください',
  'settings.field.hotkey.recordButton': '変更',
  'settings.field.hotkey.cancelButton': '取消',
  'settings.field.hotkey.prompt': 'キーを押してください…（Esc で取消）',
  'settings.field.hotkey.empty': '未設定',
  'settings.field.language': '文字起こし言語',
  'settings.field.language.help':
    '文字起こしの言語ヒント。Auto はモデルに自動判定させます。明示すると精度・速度が上がります（他言語も認識は継続）',
  'settings.field.language.auto': '自動検出 (Auto)',
  'settings.field.uiLanguage': '表示言語',
  'settings.field.uiLanguage.help': 'このアプリの UI 言語',
  'settings.field.autoStart': 'ログイン時に起動',
  'settings.field.autoStart.help.supported':
    'OS にサインインしたとき自動で WhisperAnywhere を立ち上げます',
  'settings.field.autoStart.help.unsupported': '開発モードでは無効（インストール版でのみ動作）',
  'settings.saveButton': '保存',
  'settings.saving': '保存中…',
  'settings.saved': '保存しました',
  'settings.saveFailed': '保存に失敗しました',
  'settings.clearFailed': '削除に失敗しました',
  'settings.keyCleared': 'API キーを削除しました',
  'settings.autoStartFailed': '自動起動の設定に失敗しました',

  'status.idle': '待機中',
  'status.listening': '聞き取り中',
  'status.transcribing': '文字起こし中',
  'status.pasting': '貼り付け中',
  'status.done': '完了',
  'status.error': 'エラー',

  'status.text.listening': '聞き取り中…',
  'status.text.finalizing': '確定待ち…',
  'status.text.noTranscript': '（文字起こしなし）',
  'status.text.copyOnly': 'コピー: {text}',

  'transcript.placeholder': '話してください…',

  'tray.openSettings': '設定…',
  'tray.restart': '再起動',
  'tray.quit': '終了',

  'notification.errorTitle': 'WhisperAnywhere エラー',

  'error.noApiKey': 'OPENAI_API_KEY が未設定です。トレイ → 設定 から登録してください',
  'error.hotkeyRegisterFailed': 'ホットキー登録失敗: {hotkey}',
  'error.pasteFailed': '貼り付け失敗: {message}'
}

const en: Strings = {
  'settings.title': 'WhisperAnywhere Settings',
  'settings.loading': 'Loading…',
  'settings.field.apiKey': 'OpenAI API Key',
  'settings.field.apiKey.help.set': 'Set (leave blank to keep current value)',
  'settings.field.apiKey.help.unset': 'Not set',
  'settings.field.apiKey.placeholder.set': '•••••••• (enter only to change)',
  'settings.field.apiKey.placeholder.unset': 'sk-…',
  'settings.field.apiKey.clearButton': 'Clear key',
  'settings.field.hotkey': 'Hotkey',
  'settings.field.hotkey.help':
    'Press "Change" then press the key combo you want to use as the hotkey',
  'settings.field.hotkey.recordButton': 'Change',
  'settings.field.hotkey.cancelButton': 'Cancel',
  'settings.field.hotkey.prompt': 'Press a key… (Esc to cancel)',
  'settings.field.hotkey.empty': 'Not set',
  'settings.field.language': 'Transcription language',
  'settings.field.language.help':
    "Hint for the transcription language. Auto lets the model detect. Setting a specific language improves accuracy and latency (other languages are still recognized).",
  'settings.field.language.auto': 'Auto-detect',
  'settings.field.uiLanguage': 'UI language',
  'settings.field.uiLanguage.help': "Language used by WhisperAnywhere's own interface",
  'settings.field.autoStart': 'Launch at login',
  'settings.field.autoStart.help.supported':
    'Automatically start WhisperAnywhere when you sign in to your OS',
  'settings.field.autoStart.help.unsupported': 'Disabled in dev mode (packaged builds only)',
  'settings.saveButton': 'Save',
  'settings.saving': 'Saving…',
  'settings.saved': 'Saved',
  'settings.saveFailed': 'Save failed',
  'settings.clearFailed': 'Clear failed',
  'settings.keyCleared': 'API key cleared',
  'settings.autoStartFailed': 'Failed to update launch-at-login',

  'status.idle': 'Idle',
  'status.listening': 'Listening',
  'status.transcribing': 'Transcribing',
  'status.pasting': 'Pasting',
  'status.done': 'Done',
  'status.error': 'Error',

  'status.text.listening': 'Listening…',
  'status.text.finalizing': 'Finalizing…',
  'status.text.noTranscript': '(no transcript)',
  'status.text.copyOnly': 'Copied: {text}',

  'transcript.placeholder': 'Start speaking…',

  'tray.openSettings': 'Settings…',
  'tray.restart': 'Restart',
  'tray.quit': 'Quit',

  'notification.errorTitle': 'WhisperAnywhere Error',

  'error.noApiKey': 'OPENAI_API_KEY is not set. Add it via Tray → Settings.',
  'error.hotkeyRegisterFailed': 'Hotkey registration failed: {hotkey}',
  'error.pasteFailed': 'Paste failed: {message}'
}

const tables: Record<UILanguage, Strings> = { ja, en }

/**
 * Look up a UI string in the given language, optionally interpolating
 * `{name}` placeholders. Unknown placeholders are left as-is so they show
 * up in development.
 */
export function t(key: TKey, lang: UILanguage, params?: Record<string, string>): string {
  let s: string = tables[lang][key]
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(v)
    }
  }
  return s
}

/** Best-effort default based on an OS locale string (e.g. `app.getLocale()`). */
export function detectUILanguage(localeTag: string): UILanguage {
  return localeTag.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}
