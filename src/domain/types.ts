export type ISODate = string

export const TECHNIQUES = ['FUE', 'Safir FUE', 'DHI', 'FUT', 'Diğer'] as const
export type Technique = (typeof TECHNIQUES)[number]

export const AREAS = ['Ön saç çizgisi', 'Orta bölge', 'Tepe', 'Şakak', 'Sakal', 'Kaş'] as const

export const SIDE_EFFECTS = [
  'Kaşıntı',
  'Kızarıklık',
  'Uyuşma',
  'Sivilce (follikülit)',
  'Şişlik',
  'Baş ağrısı',
  'Çarpıntı',
  'Cinsel isteksizlik',
] as const

export const SHEDDING_LEVELS = ['Yok', 'Az', 'Orta', 'Fazla'] as const

export interface Surgery {
  date: ISODate
  clinic: string
  doctor: string
  city: string
  graftCount: number | null
  technique: Technique
  areas: string[]
  note: string
}

/** Bir ilacın belirli bir tarihten itibaren geçerli kullanım planı. */
export interface DoseSchedule {
  from: ISODate
  timesPerDay: number
  everyNDays: number
  /** Ara verilen günlerde doz planlanmaz, plan değerleri yeniden başlamak için korunur. */
  paused?: boolean
}

export interface Medication {
  id: string
  name: string
  kind: 'ilac' | 'takviye'
  dose: string
  /**
   * Eskiden yeniye sıralı. Plan değişince yeni kayıt eklenir, böylece geçmiş
   * günlerin uyum oranı yeni plana göre yeniden hesaplanmaz.
   */
  schedule: DoseSchedule[]
}

/** Tarih > ilaç id > alınan doz sırası (0: sabah, 1: akşam gibi). */
export type DoseLog = Record<ISODate, Record<string, number[]>>

export interface Wash {
  date: ISODate
  note: string
}

export interface ScabLog {
  start: ISODate | null
  end: ISODate | null
}

export interface CheckIn {
  id: string
  date: ISODate
  /** Beklenen son hâle göre şu anki durum, 0–100. */
  fullness: number
  shedding: number
  /** Kıl/cm² ölçümü, varsa. */
  density: number | null
  sideEffects: string[]
  note: string
  photoIds: string[]
}

export interface AppState {
  version: 1
  demo: boolean
  surgery: Surgery | null
  meds: Medication[]
  doses: DoseLog
  washes: Wash[]
  scabs: ScabLog
  checkIns: CheckIn[]
}

export const EMPTY_STATE: AppState = {
  version: 1,
  demo: false,
  surgery: null,
  meds: [],
  doses: {},
  washes: [],
  scabs: { start: null, end: null },
  checkIns: [],
}
