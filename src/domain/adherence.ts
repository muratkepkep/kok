import { addDays, diffDays, eachDay, maxDate, minDate, weekdayIndex } from './dates'
import type { DoseLog, DoseSchedule, ISODate, Medication } from './types'

export const scheduleOn = (med: Medication, date: ISODate): DoseSchedule | null => {
  let current: DoseSchedule | null = null
  for (const entry of med.schedule) if (entry.from <= date) current = entry
  return current
}

const latestPlan = (med: Medication) => med.schedule[med.schedule.length - 1]

export const isStopped = (med: Medication) => latestPlan(med).paused === true

/** Ara verilmiş olsa bile ilacın geçerli kullanım sıklığı. */
export const activePlan = (med: Medication) => {
  const { timesPerDay, everyNDays } = latestPlan(med)
  return { timesPerDay, everyNDays }
}

/**
 * Plan değişikliği, ara verme ve yeniden başlama bugünden geçerli olur; böylece
 * geçmiş günlerin uyumu ve ara verilen günler sonradan eksik doza dönüşmez.
 */
export const withPlan = (
  schedule: DoseSchedule[],
  plan: Omit<DoseSchedule, 'from'>,
  today: ISODate,
): DoseSchedule[] => {
  const last = schedule[schedule.length - 1]
  return last.from >= today
    ? [...schedule.slice(0, -1), { ...last, ...plan }]
    : [...schedule, { from: today, ...plan }]
}

export const plannedSlots = (med: Medication, date: ISODate) => {
  const schedule = scheduleOn(med, date)
  if (!schedule || schedule.paused) return 0
  return diffDays(schedule.from, date) % schedule.everyNDays === 0 ? schedule.timesPerDay : 0
}

/** İlaç o gün kullanımda mı; gün aşırı planın boş günleri de kullanımda sayılır. */
export const inUseOn = (med: Medication, date: ISODate) => {
  const schedule = scheduleOn(med, date)
  return schedule !== null && !schedule.paused
}

export const takenSlots = (doses: DoseLog, medId: string, date: ISODate, planned: number) =>
  (doses[date]?.[medId] ?? []).filter((slot) => slot < planned).length

export const medStart = (med: Medication) => med.schedule[0].from

export const SLOT_NAMES: Record<number, string[]> = {
  1: ['Aldım'],
  2: ['Sabah', 'Akşam'],
  3: ['Sabah', 'Öğle', 'Akşam'],
  4: ['Sabah', 'Öğle', 'Akşam', 'Gece'],
}

export const scheduleLabel = (schedule: Pick<DoseSchedule, 'timesPerDay' | 'everyNDays'>) => {
  const times = schedule.timesPerDay === 1 ? 'tek doz' : `${schedule.timesPerDay} kez`
  if (schedule.everyNDays === 1) return schedule.timesPerDay === 1 ? 'Günde bir kez' : `Günde ${schedule.timesPerDay} kez`
  if (schedule.everyNDays === 2) return `Gün aşırı, ${times}`
  if (schedule.everyNDays === 7) return `Haftada bir, ${times}`
  return `${schedule.everyNDays} günde bir, ${times}`
}

export interface Tally {
  planned: number
  taken: number
  ratio: number | null
}

const toTally = (planned: number, taken: number): Tally => ({
  planned,
  taken,
  ratio: planned === 0 ? null : taken / planned,
})

/**
 * Plana göre alınan doz oranı. Bugün henüz bitmediği için alınmamış dozlar
 * eksik sayılmaz, yalnızca alınanlar hesaba girer.
 */
export const tally = (
  meds: Medication[],
  doses: DoseLog,
  from: ISODate,
  to: ISODate,
  today: ISODate,
): Tally => {
  let planned = 0
  let taken = 0
  const last = minDate(to, today)
  for (const date of eachDay(from, last)) {
    for (const med of meds) {
      const slots = plannedSlots(med, date)
      if (slots === 0) continue
      const done = takenSlots(doses, med.id, date, slots)
      planned += date === today ? done : slots
      taken += done
    }
  }
  return toTally(planned, taken)
}

/** Takvim hücresi için günün gerçek oranı; o gün plan yoksa null. */
export const dayRatio = (meds: Medication[], doses: DoseLog, date: ISODate) => {
  let planned = 0
  let taken = 0
  for (const med of meds) {
    const slots = plannedSlots(med, date)
    planned += slots
    taken += takenSlots(doses, med.id, date, slots)
  }
  return planned === 0 ? null : taken / planned
}

/**
 * Tüm planlı dozların alındığı ardışık gün sayısı. Planı olmayan günler seriyi
 * bozmaz; bugün tamamlanmadıysa seri dünden devam eder.
 */
export const streak = (meds: Medication[], doses: DoseLog, today: ISODate) => {
  if (meds.length === 0) return 0
  const first = meds.map(medStart).reduce(minDate)
  let count = 0
  for (let date = today; date >= first; date = addDays(date, -1)) {
    const ratio = dayRatio(meds, doses, date)
    if (ratio === null) continue
    if (ratio >= 1) count += 1
    else if (date !== today) break
  }
  return count
}

export interface WeekdayMiss {
  weekday: number
  planned: number
  missed: number
}

/** Bugün hariç, haftanın her günü için kaçan doz sayısı. */
export const weekdayMisses = (meds: Medication[], doses: DoseLog, from: ISODate, today: ISODate) => {
  const rows: WeekdayMiss[] = Array.from({ length: 7 }, (_, weekday) => ({ weekday, planned: 0, missed: 0 }))
  for (const date of eachDay(from, addDays(today, -1))) {
    const row = rows[weekdayIndex(date)]
    for (const med of meds) {
      const slots = plannedSlots(med, date)
      row.planned += slots
      row.missed += slots - takenSlots(doses, med.id, date, slots)
    }
  }
  return rows
}

/** Sabah ve akşam gibi doz sıralarının ayrı ayrı uyumu. Bugün hariçtir. */
export const slotTally = (med: Medication, doses: DoseLog, today: ISODate) => {
  const rows: { planned: number; taken: number }[] = []
  for (const date of eachDay(medStart(med), addDays(today, -1))) {
    const slots = plannedSlots(med, date)
    const done = doses[date]?.[med.id] ?? []
    for (let slot = 0; slot < slots; slot += 1) {
      rows[slot] ??= { planned: 0, taken: 0 }
      rows[slot].planned += 1
      if (done.includes(slot)) rows[slot].taken += 1
    }
  }
  return rows.map((row) => toTally(row.planned, row.taken))
}

/** Gerçekleşen kullanım sıklığı: ara verilmeyen günlerde haftada alınan ortalama doz. */
export const weeklyRate = (med: Medication, doses: DoseLog, today: ISODate) => {
  const from = medStart(med)
  let days = 0
  for (const date of eachDay(from, today)) if (inUseOn(med, date)) days += 1
  if (days === 0) return null
  return (tally([med], doses, from, today, today).taken / days) * 7
}

/** Son n günün penceresi, ilacın başlangıcından önceye taşmaz. */
export const windowTally = (meds: Medication[], doses: DoseLog, days: number, today: ISODate) => {
  if (meds.length === 0) return toTally(0, 0)
  const first = meds.map(medStart).reduce(minDate)
  return tally(meds, doses, maxDate(first, addDays(today, -(days - 1))), today, today)
}
