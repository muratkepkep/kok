import type { ISODate } from './types'

// Tarihler 'YYYY-AA-GG' metni olarak tutulur. new Date('2026-03-01') UTC gece
// yarısı üretir, bu yüzden hesaplar yerel saat yerine hep Date.UTC ile yapılır.

const pad = (n: number) => String(n).padStart(2, '0')

const parts = (iso: ISODate) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

const asUTC = (iso: ISODate) => {
  const { y, m, d } = parts(iso)
  return new Date(Date.UTC(y, m - 1, d))
}

const fromUTC = (date: Date): ISODate =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`

export const localToday = (now = new Date()): ISODate =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

export const isISODate = (value: unknown): value is ISODate =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  fromUTC(asUTC(value)) === value

/** b tarihi a tarihinden kaç gün sonra. */
export const diffDays = (a: ISODate, b: ISODate) =>
  Math.round((asUTC(b).getTime() - asUTC(a).getTime()) / 86_400_000)

export const addDays = (iso: ISODate, n: number): ISODate => {
  const date = asUTC(iso)
  date.setUTCDate(date.getUTCDate() + n)
  return fromUTC(date)
}

/** Ay sonuna taşarsa son güne çeker: 31 Ocak + 1 ay = 28 Şubat. */
export const addMonths = (iso: ISODate, n: number): ISODate => {
  const { y, m, d } = parts(iso)
  const total = y * 12 + (m - 1) + n
  const year = Math.floor(total / 12)
  const month = total - year * 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, lastDay))}`
}

export const minDate = (a: ISODate, b: ISODate) => (a < b ? a : b)
export const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b)

export function* eachDay(from: ISODate, to: ISODate) {
  for (let day = from; day <= to; day = addDays(day, 1)) yield day
}

/** Pazartesi 0, pazar 6. */
export const weekdayIndex = (iso: ISODate) => (asUTC(iso).getUTCDay() + 6) % 7

export const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const dayMonthShort = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fullDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const weekdayLong = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', timeZone: 'UTC' })

export const fmtDay = (iso: ISODate) => dayMonth.format(asUTC(iso))
export const fmtDayShort = (iso: ISODate) => dayMonthShort.format(asUTC(iso))
export const fmtFull = (iso: ISODate) => fullDate.format(asUTC(iso))
export const fmtWeekday = (iso: ISODate) => weekdayLong.format(asUTC(iso))

export const fmtRange = (from: ISODate, to: ISODate) => `${fmtDayShort(from)} – ${fmtDayShort(to)}`
