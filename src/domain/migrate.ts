import { DEFAULT_REMINDERS, DOSE_UNITS, EMPTY_STATE, type AppState, type DoseUnit, type Medication } from './types'

export const DEFAULT_SLOT_TIMES: Record<number, string[]> = {
  1: ['09:00'],
  2: ['09:00', '21:00'],
  3: ['09:00', '14:00', '21:00'],
  4: ['08:00', '13:00', '18:00', '22:00'],
}

const DOSE_PATTERN = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|ml|iu|g)\b/i

/** "1 mg tablet" gibi serbest metinden miktar ve birim çıkarır; tahmin edilemiyorsa boş bırakır. */
export const parseDose = (text: string): { amount: number | null; unit: DoseUnit | null } => {
  const match = DOSE_PATTERN.exec(text)
  if (!match) return { amount: null, unit: null }
  const unit = match[2].toLowerCase() === 'iu' ? 'IU' : (match[2].toLowerCase() as DoseUnit)
  return { amount: Number(match[1].replace(',', '.')), unit: DOSE_UNITS.includes(unit) ? unit : null }
}

const migrateMed = (raw: Partial<Medication> & Pick<Medication, 'id' | 'name' | 'schedule'>): Medication => {
  const dose = raw.dose ?? ''
  const parsed = parseDose(dose)
  const latest = raw.schedule[raw.schedule.length - 1]
  return {
    kind: 'ilac',
    endDate: null,
    stock: null,
    note: '',
    ...raw,
    dose,
    unit: raw.unit ?? parsed.unit ?? 'uygulama',
    slotTimes: raw.slotTimes ?? DEFAULT_SLOT_TIMES[latest.timesPerDay] ?? DEFAULT_SLOT_TIMES[1],
    schedule: raw.schedule.map((entry) => ({ ...entry, amount: entry.amount ?? parsed.amount })),
  }
}

/** Eski sürüm kayıtlarını, hiçbir veriyi kaybetmeden güncel yapıya taşır. */
export const migrate = (raw: Record<string, unknown>): AppState => {
  const old = raw as unknown as AppState
  return {
    ...EMPTY_STATE,
    ...old,
    version: 2,
    surgery: old.surgery ? { ...old.surgery, clinicPhone: old.surgery.clinicPhone ?? '', graftMap: old.surgery.graftMap ?? {} } : null,
    meds: (old.meds ?? []).map(migrateMed),
    checkIns: (old.checkIns ?? []).map((entry) => ({ ...entry, photoAngles: entry.photoAngles ?? {} })),
    reminders: { ...DEFAULT_REMINDERS, ...old.reminders },
  }
}
