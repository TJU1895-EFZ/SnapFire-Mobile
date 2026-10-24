/**
 * Types for the IndexedDB storage layer.
 * Mirrors the desktop's window.snapfire.storage interfaces so the rest of
 * the app can swap IPC for IndexedDB with minimal changes.
 */

import type {
  AppearanceData,
  AppSettings,
  HistoryData,
  MatchResult,
  ProfileData
} from '@shared/types'

// ── Store names ────────────────────────────────────────────────────────────

export const DB_NAME = 'snapfire-mobile'
export const DB_VERSION = 1

export const STORE_PROFILE = 'profile'
export const STORE_SETTINGS = 'settings'
export const STORE_APPEARANCE = 'appearance'
export const STORE_HISTORY = 'history'

// Each store holds exactly one record with this key.
export const CURRENT_KEY = 'current'

// ── Storage API ────────────────────────────────────────────────────────────

/**
 * IndexedDB-backed persistence.  The surface matches
 * `window.snapfire.storage.*` from the desktop version.
 */
export interface StorageApi {
  loadProfile(): Promise<ProfileData>
  saveProfile(profile: ProfileData): Promise<void>
  loadSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<void>
  loadAppearance(): Promise<AppearanceData | null>
  saveAppearance(appearance: AppearanceData | null): Promise<void>
  loadHistory(): Promise<HistoryData>
  addHistory(result: MatchResult): Promise<HistoryData>
  clearHistory(): Promise<void>
  resetAll(): Promise<void>
  consumeWarnings(): Promise<string[]>
}
