/**
 * IndexedDB persistence layer.
 *
 * Replaces the desktop's `window.snapfire.storage.*` IPC calls.
 * Each data domain (profile, settings, appearance, history) lives in its
 * own object store with a single `'current'` record.
 */

import type {
  AppearanceData,
  AppSettings,
  HistoryData,
  MatchResult,
  ProfileData
} from '@shared/types'
import {
  CURRENT_KEY,
  DB_NAME,
  DB_VERSION,
  STORE_APPEARANCE,
  STORE_HISTORY,
  STORE_PROFILE,
  STORE_SETTINGS,
  type StorageApi
} from './types'

// ── Default values ─────────────────────────────────────────────────────────

import { DEFAULT_APP_SETTINGS } from '@shared/types'

/** Generate a short random ID using crypto when available. */
function uid(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = crypto.getRandomValues(new Uint8Array(length))
    return Array.from(buf, (b) => chars[b % chars.length]).join('')
  }
  // Fallback for non-secure contexts.
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function createDefaultProfile(): ProfileData {
  const now = Date.now()
  const id = uid(16)
  return {
    id,
    name: `玩家${uid(4).toUpperCase()}`,
    createdAt: now,
    updatedAt: now
  }
}

function createDefaultSettings(): AppSettings {
  return { ...DEFAULT_APP_SETTINGS }
}

function createDefaultHistory(): HistoryData {
  return { matches: [] }
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      // Create one store per domain if it doesn't exist yet.
      if (!db.objectStoreNames.contains(STORE_PROFILE)) {
        db.createObjectStore(STORE_PROFILE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_APPEARANCE)) {
        db.createObjectStore(STORE_APPEARANCE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Read a JSON record from a store.  Returns `null` when not found. */
async function loadFromStore<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

/** Write a JSON record to a store. */
async function saveToStore<T extends { key: string }>(
  storeName: string,
  record: T
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.put(record)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Delete all records in a store. */
async function clearStore(storeName: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ── StorageApi implementation ──────────────────────────────────────────────

let _warnings: string[] = []

export class IndexedDbStorage implements StorageApi {
  // ── Profile ────────────────────────────────────────────────────────────

  async loadProfile(): Promise<ProfileData> {
    try {
      const record = await loadFromStore<ProfileData>(STORE_PROFILE, CURRENT_KEY)
      if (record) return record
    } catch {
      // corrupt data — fall through to defaults
    }
    const profile = createDefaultProfile()
    await this.saveProfile(profile)
    return profile
  }

  async saveProfile(profile: ProfileData): Promise<void> {
    profile.updatedAt = Date.now()
    await saveToStore(STORE_PROFILE, { key: CURRENT_KEY, ...profile })
  }

  // ── Settings ───────────────────────────────────────────────────────────

  async loadSettings(): Promise<AppSettings> {
    try {
      const record = await loadFromStore<AppSettings>(STORE_SETTINGS, CURRENT_KEY)
      if (record) {
        // Merge with defaults so new fields appear on first use.
        return { ...createDefaultSettings(), ...record }
      }
    } catch {
      // corrupt data
    }
    const settings = createDefaultSettings()
    await this.saveSettings(settings)
    return settings
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await saveToStore(STORE_SETTINGS, { key: CURRENT_KEY, ...settings })
  }

  // ── Appearance ─────────────────────────────────────────────────────────

  async loadAppearance(): Promise<AppearanceData | null> {
    try {
      return await loadFromStore<AppearanceData>(STORE_APPEARANCE, CURRENT_KEY)
    } catch {
      return null
    }
  }

  async saveAppearance(appearance: AppearanceData | null): Promise<void> {
    if (appearance === null) {
      await clearStore(STORE_APPEARANCE)
      return
    }
    await saveToStore(STORE_APPEARANCE, { key: CURRENT_KEY, ...appearance })
  }

  // ── History ────────────────────────────────────────────────────────────

  async loadHistory(): Promise<HistoryData> {
    try {
      const record = await loadFromStore<HistoryData>(STORE_HISTORY, CURRENT_KEY)
      if (record) return record
    } catch {
      // corrupt data
    }
    const history = createDefaultHistory()
    await this.saveHistory(history)
    return history
  }

  private async saveHistory(history: HistoryData): Promise<void> {
    await saveToStore(STORE_HISTORY, { key: CURRENT_KEY, ...history })
  }

  async addHistory(result: MatchResult): Promise<HistoryData> {
    const history = await this.loadHistory()
    history.matches.unshift(result)
    // Keep last 100 matches.
    if (history.matches.length > 100) history.matches.length = 100
    await this.saveHistory(history)
    return history
  }

  async clearHistory(): Promise<void> {
    await saveToStore(STORE_HISTORY, { key: CURRENT_KEY, ...createDefaultHistory() })
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  async resetAll(): Promise<void> {
    await clearStore(STORE_PROFILE)
    await clearStore(STORE_SETTINGS)
    await clearStore(STORE_APPEARANCE)
    await clearStore(STORE_HISTORY)
    _warnings = []
  }

  async consumeWarnings(): Promise<string[]> {
    const warnings = _warnings
    _warnings = []
    return warnings
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

export const storage = new IndexedDbStorage()
