import { app, safeStorage } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DEFAULT_HOTKEY,
  LANGUAGE_OPTIONS,
  type AppSettings,
  type LanguageCode,
  type SettingsUpdate
} from '@shared/settings'

const VALID_LANGUAGES = new Set<string>(LANGUAGE_OPTIONS.map((o) => o.code))

/**
 * On-disk schema. The API key is stored encrypted when OS keychain access is
 * available (safeStorage); otherwise as plaintext (with a warning logged).
 */
interface DiskSettings {
  hotkey?: string
  apiKeyEnc?: string // base64-encoded encrypted bytes
  apiKey?: string // plaintext fallback when safeStorage is unavailable
  /** ISO timestamp of the first successful launch; absence means we've never launched before. */
  firstLaunchAt?: string
  /** ISO-639-1 transcription language hint. '' or missing = auto-detect. */
  language?: string
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

/** Returns the persisted language hint, defaulting to '' (auto-detect). */
export async function getLanguage(): Promise<LanguageCode> {
  const data = await loadFromDisk()
  const v = data.language ?? ''
  return VALID_LANGUAGES.has(v) ? (v as LanguageCode) : ''
}

/**
 * Returns the persistence-managed slice of AppSettings (hotkey, hasApiKey,
 * language). OS-level flags like autoStart live in services/autoStart.ts
 * and are merged in by the IPC layer.
 */
export type PersistedSettings = Pick<AppSettings, 'hotkey' | 'hasApiKey' | 'language'>

export async function getAppSettings(): Promise<PersistedSettings> {
  const data = await loadFromDisk()
  const hasFromFile = Boolean(data.apiKeyEnc || data.apiKey)
  const hasFromEnv = Boolean(process.env.OPENAI_API_KEY?.trim())
  return {
    hotkey: data.hotkey?.trim() || DEFAULT_HOTKEY,
    hasApiKey: hasFromFile || hasFromEnv,
    language: await getLanguage()
  }
}

/** True if no prior launch has been recorded on disk. */
export async function isFirstLaunch(): Promise<boolean> {
  const data = await loadFromDisk()
  return !data.firstLaunchAt
}

/** Stamp the settings file so isFirstLaunch() returns false next time. No-op if already stamped. */
export async function markFirstLaunchComplete(): Promise<void> {
  const data = { ...(await loadFromDisk()) }
  if (data.firstLaunchAt) return
  data.firstLaunchAt = new Date().toISOString()
  await persist(data)
}

/** Applies a partial update. Returns the new persisted settings. */
export async function updateSettings(update: SettingsUpdate): Promise<PersistedSettings> {
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

  if (update.language !== undefined) {
    if (update.language && VALID_LANGUAGES.has(update.language)) {
      data.language = update.language
    } else {
      delete data.language // empty string / unknown code → auto-detect
    }
  }

  await persist(data)
  return getAppSettings()
}
