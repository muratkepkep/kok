import { diffDays } from './dates'
import type { ISODate, ScabLog, Wash } from './types'

export const TYPICAL_SCAB_END = { from: 10, to: 14 }
/** İlk iki haftadaki sık yıkama, sonraki düzenden ayrı değerlendirilir. */
const EARLY_PHASE_DAYS = 14

export interface WashRow {
  date: ISODate
  day: number
  gap: number | null
  note: string
}

const average = (values: number[]) =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length

export const washStats = (surgeryDate: ISODate, washes: Wash[], today: ISODate) => {
  const sorted = washes
    .filter((wash) => wash.date >= surgeryDate)
    .sort((a, b) => a.date.localeCompare(b.date))

  const rows: WashRow[] = sorted.map((wash, index) => ({
    date: wash.date,
    day: diffDays(surgeryDate, wash.date),
    gap: index === 0 ? null : diffDays(sorted[index - 1].date, wash.date),
    note: wash.note,
  }))

  const withGap = rows.filter((row): row is WashRow & { gap: number } => row.gap !== null)
  const gaps = withGap.map((row) => row.gap)
  const last = rows[rows.length - 1]

  return {
    rows,
    count: rows.length,
    firstDay: rows[0]?.day ?? null,
    averageGap: average(gaps),
    shortestGap: gaps.length ? Math.min(...gaps) : null,
    longestGap: gaps.length ? Math.max(...gaps) : null,
    earlyAverageGap: average(withGap.filter((row) => row.day <= EARLY_PHASE_DAYS).map((row) => row.gap)),
    lateAverageGap: average(withGap.filter((row) => row.day > EARLY_PHASE_DAYS).map((row) => row.gap)),
    daysSinceLast: last ? diffDays(last.date, today) : null,
  }
}

/** Haftalara göre ortalama yıkama aralığı; ilk yıkamanın aralığı olmadığı için sayılmaz. */
export const weeklyWashGaps = (rows: WashRow[]) => {
  const weeks = new Map<number, number[]>()
  for (const row of rows) {
    if (row.gap === null) continue
    const week = Math.floor(row.day / 7) + 1
    weeks.set(week, [...(weeks.get(week) ?? []), row.gap])
  }
  return [...weeks.entries()].map(([week, gaps]) => ({
    week,
    averageGap: average(gaps) as number,
    washes: gaps.length,
  }))
}

export type ScabStatus = 'bekliyor' | 'suruyor' | 'tamam'
export type ScabTiming = 'erken' | 'tipik' | 'gec'

export const scabStats = (surgeryDate: ISODate, scabs: ScabLog, today: ISODate) => {
  const startDay = scabs.start ? diffDays(surgeryDate, scabs.start) : null
  const endDay = scabs.end ? diffDays(surgeryDate, scabs.end) : null
  const status: ScabStatus = endDay !== null ? 'tamam' : startDay !== null ? 'suruyor' : 'bekliyor'
  const timing: ScabTiming | null =
    endDay === null
      ? null
      : endDay < TYPICAL_SCAB_END.from
        ? 'erken'
        : endDay > TYPICAL_SCAB_END.to
          ? 'gec'
          : 'tipik'
  return {
    status,
    startDay,
    endDay,
    timing,
    durationDays: scabs.start && scabs.end ? diffDays(scabs.start, scabs.end) + 1 : null,
    runningDays: status === 'suruyor' && scabs.start ? diffDays(scabs.start, today) + 1 : null,
    overdue: endDay === null && diffDays(surgeryDate, today) > TYPICAL_SCAB_END.to,
  }
}
