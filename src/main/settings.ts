import { app, safeStorage } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_HOTKEY, type AppSettings, type SettingsUpdate } from '@shared/settings'

/**
 * On-disk schema. The API key is stored encrypted when OS keychain access is
 * available (safeStorage); otherwise as plaintext (with a warning logged).
 */
interface DiskSettings {
  hotkey?: string
  apiKeyEnc?: string // base64-encoded encrypted bytes
  apiKey?: string // plaintext fallback when safeStorage is unavailable
}

const FILE_NAME = 'settings.json'

let cache: DiskSettings | null = null

function filePath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

async function loadFromDisk(): Promise<DiskSettings> {
  if (cache) return cache
  try {
    const text = await readFile(filePath(), 'utf-8')
    cache = JSON.parse(text) as DiskSettings
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      cache = {}
    } else {
      console.warn('[whisper-anywhere] settings.json 読み込み失敗、デフォルト使用', err)
      cache = {}
    }
  }
  return cache
}

async function persist(data: DiskSettings): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(filePath(), JSON.stringify(data, null, 2), 'utf-8')
  cache = data
}

/** Returns the resolved API key (settings file → env var fallback), or null. */
export async function getApiKey(): Promise<string | null> {
  const data = await loadFromDisk()
  if (data.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(data.apiKeyEnc, 'base64'))
    } catch (err) {
      console.warn('[whisper-anywhere] API key 復号失敗', err)
    }
  }
  if (data.apiKey) return data.apiKey
  const env = process.env.OPENAI_API_KEY?.trim()
  return env && env.length > 0 ? env : null
}

export async function getHotkey(): Promise<string> {
  const data = await loadFromDisk()
  return data.hotkey?.trim() || DEFAULT_HOTKEY
}

/** Returns AppSettings safe to send over IPC (no plaintext API key). */
export async function getAppSettings(): Promise<AppSettings> {
  const data = await loadFromDisk()
  const hasFromFile = Boolean(data.apiKeyEnc || data.apiKey)
  const hasFromEnv = Boolean(process.env.OPENAI_API_KEY?.trim())
  return {
    hotkey: data.hotkey?.trim() || DEFAULT_HOTKEY,
    hasApiKey: hasFromFile || hasFromEnv
  }
}

/** Applies a partial update. Returns the new resolved settings. */
export async function updateSettings(update: SettingsUpdate): Promise<AppSettings> {
  const data = { ...(await loadFromDisk()) }

  if (update.hotkey !== undefined) {
    data.hotkey = update.hotkey.trim() || DEFAULT_HOTKEY
  }

  if (update.apiKey !== undefined) {
    if (update.apiKey === null || update.apiKey.trim() === '') {
      delete data.apiKey
      delete data.apiKeyEnc
    } else if (safeStorage.isEncryptionAvailable()) {
      data.apiKeyEnc = safeStorage.encryptString(update.apiKey).toString('base64')
      delete data.apiKey
    } else {
      console.warn('[whisper-anywhere] safeStorage 不可、API key を平文保存します')
      data.apiKey = update.apiKey
      delete data.apiKeyEnc
    }
  }

  await persist(data)
  return getAppSettings()
}
