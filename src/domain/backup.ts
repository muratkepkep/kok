import { isISODate } from './dates'
import { migrate } from './migrate'
import type { AppState } from './types'

export interface Backup {
  app: 'kok'
  exportedAt: string
  state: AppState
  /** Fotoğraf id > data URL. */
  photos: Record<string, string>
}

export const buildBackup = (
  state: AppState,
  photos: Record<string, string>,
  now = new Date(),
): Backup => ({ app: 'kok', exportedAt: now.toISOString(), state, photos })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Dosya bozuksa kullanıcıya gösterilecek açıklamayla hata fırlatır. */
export const parseBackup = (text: string): Backup => {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Dosya okunamadı. Kök uygulamasından alınmış bir yedek seç.')
  }
  if (!isRecord(raw) || raw.app !== 'kok' || !isRecord(raw.state)) {
    throw new Error('Bu dosya bir Kök yedeği değil.')
  }
  const state = raw.state
  if (state.version !== 1 && state.version !== 2) throw new Error('Bu yedek, uygulamanın bu sürümüyle açılamıyor.')
  if (
    !isRecord(state.surgery) ||
    !isISODate(state.surgery.date) ||
    !Array.isArray(state.meds) ||
    !isRecord(state.doses) ||
    !Array.isArray(state.washes) ||
    !Array.isArray(state.checkIns)
  ) {
    throw new Error('Yedek eksik görünüyor, geri yüklenemedi.')
  }
  return {
    app: 'kok',
    exportedAt: String(raw.exportedAt ?? ''),
    state: migrate(state),
    photos: isRecord(raw.photos) ? (raw.photos as Record<string, string>) : {},
  }
}
