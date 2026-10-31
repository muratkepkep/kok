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

export const DOSE_UNITS = ['mg', 'mcg', 'g', 'ml', 'IU', 'tablet', 'kapsül', 'damla', 'pompa', 'sprey', 'uygulama'] as const
export type DoseUnit = (typeof DOSE_UNITS)[number]

export const PHOTO_ANGLES = ['Ön', 'Sol', 'Sağ', 'Tepe', 'Donör', 'Diğer'] as const
export type PhotoAngle = (typeof PHOTO_ANGLES)[number]

export interface Surgery {
  date: ISODate
  clinic: string
  doctor: string
  city: string
  clinicPhone: string
  graftCount: number | null
  /** Bölge adı > ekilen greft. */
  graftMap: Record<string, number>
  technique: Technique
  areas: string[]
  note: string
}

/** Bir ilacın belirli bir tarihten itibaren geçerli kullanım planı. */
export interface DoseSchedule {
  from: ISODate
  timesPerDay: number
  everyNDays: number
  /** Pazartesi 0. Doluysa everyNDays yerine bu günler geçerlidir. */
  weekdays?: number[] | null
  /** Doz başına miktar; değişiklik geçmişi bu kayıtlardan okunur. */
  amount?: number | null
  /** Ara verilen günlerde doz planlanmaz, plan değerleri yeniden başlamak için korunur. */
  paused?: boolean
  /** "N günde bir" sayımının başladığı gün; doz değişince ritim kaymasın diye taşınır. */
  anchor?: ISODate
}

/** Stok, başlangıç adedinden alınan dozlar çıkarılarak hesaplanır. */
export interface StockLog {
  from: ISODate
  units: number
  perDose: number
  alertDays: number
}

export type MedKind = 'ilac' | 'takviye' | 'bakim'

export interface Medication {
  id: string
  name: string
  kind: MedKind
  /** Serbest biçim tanımı: "%5 köpük", "film tablet". */
  dose: string
  unit: DoseUnit
  /**
   * Eskiden yeniye sıralı. Plan değişince yeni kayıt eklenir, böylece geçmiş
   * günlerin uyum oranı yeni plana göre yeniden hesaplanmaz.
   */
  schedule: DoseSchedule[]
  /** Doz sırasına göre hatırlatma saati, 'SS:DD'. */
  slotTimes: string[]
  /** Kür bitişi; bu tarihten sonra doz planlanmaz. */
  endDate: ISODate | null
  stock: StockLog | null
  note: string
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
  /** Fotoğraf id > çekim açısı. */
  photoAngles: Record<string, PhotoAngle>
}

export interface SymptomLog {
  /** Belirti adı > 0–3 şiddet. */
  scores: Record<string, number>
  /** İşaretlenen acil belirtiler. */
  flags: string[]
  note: string
}

export const APPOINTMENT_KINDS = ['Kontrol', 'PRP', 'Mezoterapi', 'Tahlil', 'Yıkama', 'Diğer'] as const
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number]

export interface Appointment {
  id: string
  kind: AppointmentKind
  title: string
  date: ISODate
  time: string
  note: string
  done: boolean
}

export interface ReminderSettings {
  enabled: boolean
  doses: boolean
  /** Doz işaretlenene kadar yeniden hatırlat. */
  nag: boolean
  nagMinutes: number
  wash: boolean
  washTime: string
  washEveryDays: number
  checkIn: boolean
  checkInTime: string
  symptoms: boolean
  appointments: boolean
  rules: boolean
  stock: boolean
  milestones: boolean
  /** Kilit ekranında ilaç adı gösterme. */
  hideDetails: boolean
  quietStart: string
  quietEnd: string
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: true,
  doses: true,
  nag: true,
  nagMinutes: 30,
  wash: true,
  washTime: '10:00',
  washEveryDays: 2,
  checkIn: true,
  checkInTime: '20:00',
  symptoms: true,
  appointments: true,
  rules: true,
  stock: true,
  milestones: true,
  hideDetails: false,
  quietStart: '23:30',
  quietEnd: '07:30',
}

export interface AppState {
  version: 2
  demo: boolean
  surgery: Surgery | null
  meds: Medication[]
  doses: DoseLog
  washes: Wash[]
  scabs: ScabLog
  checkIns: CheckIn[]
  symptoms: Record<ISODate, SymptomLog>
  appointments: Appointment[]
  /** Kural kimliği > kliniğin söylediği gün sayısı. */
  ruleDays: Record<string, number>
  reminders: ReminderSettings
  clinicNotes: string
}

export const EMPTY_STATE: AppState = {
  version: 2,
  demo: false,
  surgery: null,
  meds: [],
  doses: {},
  washes: [],
  scabs: { start: null, end: null },
  checkIns: [],
  symptoms: {},
  appointments: [],
  ruleDays: {},
  reminders: DEFAULT_REMINDERS,
  clinicNotes: '',
}
