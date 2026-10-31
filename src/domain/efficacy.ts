import { tally, type Tally } from './adherence'
import { minDate } from './dates'
import { dayNumber, expectedAt, monthNumber, monthPeriod, type Period } from './timeline'
import type { AppState, CheckIn, ISODate } from './types'

/** Literatürde ilaç uyumu için en yaygın eşik. */
export const GOOD_ADHERENCE = 0.8
export const MIN_COMPARABLE_MONTHS = 3
/** Aylık üç puandan küçük farklar kişisel değerlendirmenin gürültüsü sayılır. */
export const MEANINGFUL_DIFF = 3

export interface MonthRow extends Period {
  complete: boolean
  adherence: Tally
  perMed: Record<string, Tally>
  washes: number
  checkIns: CheckIn[]
  score: number | null
  expectedMid: number | null
  /** Ölçümün beklenen orta değerden farkı, puan. */
  gap: number | null
  /** Doğal seyrin üstünde kalan aylık ilerleme, puan. */
  net: number | null
}

export const sortedCheckIns = (checkIns: CheckIn[]) =>
  [...checkIns].sort((a, b) => a.date.localeCompare(b.date))

export const monthRows = (state: AppState, today: ISODate): MonthRow[] => {
  const surgeryDate = state.surgery?.date
  if (!surgeryDate || today < surgeryDate) return []

  const checkIns = sortedCheckIns(state.checkIns)
  const rows: MonthRow[] = []
  const current = monthNumber(surgeryDate, today)
  let previous: { n: number; gap: number } | null = null

  for (let n = 1; n <= current; n += 1) {
    const period = monthPeriod(surgeryDate, n)
    const to = minDate(period.end, today)
    const inMonth = checkIns.filter((entry) => entry.date >= period.start && entry.date <= period.end)
    const latest = inMonth[inMonth.length - 1]

    const perMed: Record<string, Tally> = {}
    for (const med of state.meds) perMed[med.id] = tally([med], state.doses, period.start, to, today)

    let expectedMid: number | null = null
    let gap: number | null = null
    let net: number | null = null
    if (latest) {
      expectedMid = expectedAt(dayNumber(surgeryDate, latest.date)).mid
      gap = latest.fullness - expectedMid
      if (previous) net = (gap - previous.gap) / (n - previous.n)
      previous = { n, gap }
    }

    rows.push({
      ...period,
      complete: period.end < today,
      adherence: tally(state.meds, state.doses, period.start, to, today),
      perMed,
      washes: state.washes.filter((wash) => wash.date >= period.start && wash.date <= period.end).length,
      checkIns: inMonth,
      score: latest?.fullness ?? null,
      expectedMid,
      gap,
      net,
    })
  }
  return rows
}

export type Verdict = 'yetersiz' | 'karsilastirma-yok' | 'olumlu' | 'belirsiz' | 'olumsuz'

export interface GroupStat {
  months: number
  averageNet: number | null
}

export interface MedEfficacy {
  verdict: Verdict
  usableMonths: number
  regular: GroupStat
  irregular: GroupStat
  diff: number | null
  /** Hangi ayların düzenli, hangilerinin düzensiz sayıldığını özetler. */
  monthKey: string
}

const groupStat = (values: number[]): GroupStat => ({
  months: values.length,
  averageNet: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
})

/**
 * Düzenli ve düzensiz kullanılan ayların net ilerlemesini karşılaştırır.
 * Net ilerleme beklenen eğriden arındırıldığı için doğal iyileşme ilaca yazılmaz.
 */
export const medEfficacy = (rows: MonthRow[], medId: string): MedEfficacy => {
  const usable = rows.filter(
    (row) => row.complete && row.net !== null && row.perMed[medId]?.ratio != null,
  )
  const regularNets: number[] = []
  const irregularNets: number[] = []
  const monthKey: string[] = []
  for (const row of usable) {
    const isRegular = (row.perMed[medId].ratio as number) >= GOOD_ADHERENCE
    ;(isRegular ? regularNets : irregularNets).push(row.net as number)
    monthKey.push(`${row.n}${isRegular ? '+' : '-'}`)
  }

  const regular = groupStat(regularNets)
  const irregular = groupStat(irregularNets)
  const diff =
    regular.averageNet !== null && irregular.averageNet !== null
      ? regular.averageNet - irregular.averageNet
      : null

  let verdict: Verdict
  if (usable.length < MIN_COMPARABLE_MONTHS) verdict = 'yetersiz'
  else if (diff === null) verdict = 'karsilastirma-yok'
  else if (diff >= MEANINGFUL_DIFF) verdict = 'olumlu'
  else if (diff <= -MEANINGFUL_DIFF) verdict = 'olumsuz'
  else verdict = 'belirsiz'

  return { verdict, usableMonths: usable.length, regular, irregular, diff, monthKey: monthKey.join(',') }
}

export interface EfficacyGroup<T> {
  meds: T[]
  result: MedEfficacy
  /** Aynı aylarda aynı düzende kullanılan ilaçların etkisi birbirinden ayrılamaz. */
  entangled: boolean
}

/** Birlikte kullanılan ilaçları tek satırda toplar; aynı sonucu ayrı ayrı göstermek yanıltır. */
export const groupEfficacy = <T extends { id: string }>(rows: MonthRow[], meds: T[]) => {
  const groups = new Map<string, EfficacyGroup<T>>()
  for (const med of meds) {
    const result = medEfficacy(rows, med.id)
    const group = groups.get(result.monthKey)
    if (group) group.meds.push(med)
    else groups.set(result.monthKey, { meds: [med], result, entangled: false })
  }
  const comparable = (verdict: Verdict) => verdict === 'olumlu' || verdict === 'belirsiz' || verdict === 'olumsuz'
  return [...groups.values()].map((group) => ({
    ...group,
    entangled: group.meds.length > 1 && comparable(group.result.verdict),
  }))
}

export type Position = 'ileride' | 'aralikta' | 'geride'

export const positionOf = (surgeryDate: ISODate, checkIn: CheckIn): Position => {
  const band = expectedAt(dayNumber(surgeryDate, checkIn.date))
  if (checkIn.fullness > band.high) return 'ileride'
  if (checkIn.fullness < band.low) return 'geride'
  return 'aralikta'
}

export interface Reading {
  tone: 'iyi' | 'dikkat'
  title: string
  body: string
}

export const readingOf = (adherence: number | null, position: Position | null): Reading | null => {
  if (adherence === null || position === null) return null
  const regular = adherence >= GOOD_ADHERENCE
  const onTrack = position !== 'geride'
  if (regular && onTrack) {
    return {
      tone: 'iyi',
      title: 'Düzenlisin ve ilerleme yolunda',
      body: position === 'ileride' ? 'Son ölçümün beklenen aralığın üzerinde.' : 'Son ölçümün beklenen aralıkta.',
    }
  }
  if (regular) {
    return {
      tone: 'dikkat',
      title: 'Düzenlisin ama ölçümün beklenenin altında',
      body: 'Gelişim kişiden kişiye değişir. Tablo birkaç ölçüm boyunca aynı kalırsa doktoruna göster.',
    }
  }
  if (onTrack) {
    return {
      tone: 'dikkat',
      title: 'İlerleme yolunda ama dozlar aksıyor',
      body: 'Son 30 günün uyumu %80 eşiğinin altında. Aksayan dozları İlaçlar sayfasından görebilirsin.',
    }
  }
  return {
    tone: 'dikkat',
    title: 'Dozlar aksıyor ve ölçümün beklenenin altında',
    body: 'Önce kullanım düzenini oturt, tablo sürerse doktoruna göster.',
  }
}

/** Son ölçümlerde en sık işaretlenen yan etkiler. */
export const sideEffectCounts = (checkIns: CheckIn[]) => {
  const counts = new Map<string, number>()
  for (const entry of checkIns) {
    for (const effect of entry.sideEffects) counts.set(effect, (counts.get(effect) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}
