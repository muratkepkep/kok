import { eachDay, addDays } from './dates'
import type { ISODate, SymptomLog } from './types'

export const SYMPTOMS = ['Ağrı', 'Şişlik', 'Kızarıklık', 'Kaşıntı', 'Uyuşma', 'Donör hassasiyeti'] as const
export const SYMPTOM_LEVELS = ['Yok', 'Hafif', 'Orta', 'Şiddetli'] as const

/** Beklemeden kliniğe veya sağlık kuruluşuna başvurulması gereken durumlar. */
export const RED_FLAGS = [
  'Ateş veya titreme',
  'İltihap veya kötü koku',
  'Hızla yayılan kızarıklık',
  'Durmayan kanama',
  'Geçmeyen şiddetli ağrı',
  'Yüzde ve göz çevresinde artan şişlik',
  'Göğüs ağrısı veya çarpıntı',
] as const

export const hasRedFlag = (log: SymptomLog | undefined) => (log?.flags.length ?? 0) > 0

/** Şiddetli işaretlenen bir belirti de kliniğe sorulmalıdır. */
export const needsAttention = (log: SymptomLog | undefined) =>
  hasRedFlag(log) || Object.values(log?.scores ?? {}).some((score) => score >= 3)

/** Belirti başına son n günün ortalaması, grafik için. */
export const symptomTrend = (logs: Record<ISODate, SymptomLog>, name: string, days: number, today: ISODate) =>
  [...eachDay(addDays(today, -(days - 1)), today)].map((date) => ({
    date,
    score: logs[date]?.scores[name] ?? null,
  }))
