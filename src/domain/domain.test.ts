import { describe, expect, it } from 'vitest'
import {
  activePlan,
  dayRatio,
  isStopped,
  plannedSlots,
  scheduleLabel,
  slotTally,
  streak,
  tally,
  weekdayMisses,
  weeklyRate,
  windowTally,
  withPlan,
} from './adherence'
import { buildBackup, parseBackup } from './backup'
import { scabStats, washStats, weeklyWashGaps } from './care'
import { addDays, addMonths, diffDays, eachDay, isISODate, localToday, weekdayIndex } from './dates'
import { buildDemoState } from './demo'
import { groupEfficacy, medEfficacy, monthRows, positionOf, readingOf, type MonthRow } from './efficacy'
import { fmtRatio, fmtScore, fmtSigned } from './format'
import {
  EXPECTED_CURVE,
  expectedAt,
  monthNumber,
  monthPeriod,
  stageAt,
  STAGES,
  weekNumber,
  weekPeriod,
} from './timeline'
import { EMPTY_STATE, type AppState, type CheckIn, type DoseLog, type Medication } from './types'

const med = (over: Partial<Medication> = {}): Medication => ({
  id: 'm',
  name: 'Minoksidil',
  kind: 'ilac',
  dose: '%5',
  unit: 'ml',
  schedule: [{ from: '2026-03-01', timesPerDay: 2, everyNDays: 1 }],
  slotTimes: ['09:00', '21:00'],
  endDate: null,
  stock: null,
  note: '',
  ...over,
})

const checkIn = (date: string, fullness: number): CheckIn => ({
  id: date,
  date,
  fullness,
  shedding: 0,
  density: null,
  sideEffects: [],
  note: '',
  photoIds: [],
  photoAngles: {},
})

describe('tarihler', () => {
  it('ay ve yıl sınırlarında gün farkını doğru sayar', () => {
    expect(diffDays('2026-02-27', '2026-03-02')).toBe(3)
    expect(diffDays('2025-12-31', '2026-01-01')).toBe(1)
    expect(diffDays('2026-03-10', '2026-03-10')).toBe(0)
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('ay sonuna taşan tarihi son güne çeker', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15')
  })

  it('yerel günü UTC yerine yerel saatten alır', () => {
    expect(localToday(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-31')
    expect(localToday(new Date(2026, 10, 1, 0, 5))).toBe('2026-11-01')
  })

  it('geçersiz tarihleri reddeder', () => {
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('2026-2-3')).toBe(false)
    expect(isISODate('2026-03-01')).toBe(true)
  })

  it('haftayı pazartesiden başlatır', () => {
    expect(weekdayIndex('2026-10-26')).toBe(0)
    expect(weekdayIndex('2026-11-01')).toBe(6)
  })
})

describe('süreç', () => {
  const surgery = '2026-03-15'

  it('ameliyat günü 1. hafta ve 1. aydır', () => {
    expect(weekNumber(surgery, surgery)).toBe(1)
    expect(monthNumber(surgery, surgery)).toBe(1)
  })

  it('hafta sınırını 7 günde bir çizer', () => {
    expect(weekNumber(surgery, addDays(surgery, 6))).toBe(1)
    expect(weekNumber(surgery, addDays(surgery, 7))).toBe(2)
    expect(weekPeriod(surgery, 2)).toMatchObject({ start: '2026-03-22', end: '2026-03-28' })
  })

  it('ay sınırını ay dönümünden çizer', () => {
    expect(monthNumber(surgery, '2026-04-14')).toBe(1)
    expect(monthNumber(surgery, '2026-04-15')).toBe(2)
    expect(monthPeriod(surgery, 2)).toMatchObject({ start: '2026-04-15', end: '2026-05-14' })
  })

  it('ay sonu ameliyatında ayları boşluksuz sürdürür', () => {
    const end = '2026-01-31'
    expect(monthNumber(end, '2026-02-27')).toBe(1)
    expect(monthNumber(end, '2026-02-28')).toBe(2)
    expect(monthNumber(end, '2026-03-30')).toBe(2)
    expect(monthNumber(end, '2026-03-31')).toBe(3)
    for (let n = 1; n < 18; n += 1) {
      expect(addDays(monthPeriod(end, n).end, 1)).toBe(monthPeriod(end, n + 1).start)
    }
  })

  it('ameliyattan önceki tarihlerde dönem üretmez', () => {
    expect(weekNumber(surgery, '2026-03-14')).toBe(0)
    expect(monthNumber(surgery, '2026-03-14')).toBe(0)
  })

  it('evreler boşluksuz ve sıralı', () => {
    for (let index = 1; index < STAGES.length; index += 1) {
      expect(STAGES[index].fromDay).toBe(STAGES[index - 1].toDay + 1)
    }
    expect(stageAt(0).title).toBe('İlk günler')
    expect(stageAt(12).title).toBe('Kabuk dökümü')
    expect(stageAt(40).title).toBe('Şok dökülme')
    expect(stageAt(900).title).toBe('Son hâl')
  })

  it('beklenen eğri tekdüze artar ve aralık doğru sıralıdır', () => {
    for (let index = 1; index < EXPECTED_CURVE.length; index += 1) {
      expect(EXPECTED_CURVE[index].mid).toBeGreaterThanOrEqual(EXPECTED_CURVE[index - 1].mid)
    }
    for (const point of EXPECTED_CURVE) {
      expect(point.low).toBeLessThanOrEqual(point.mid)
      expect(point.mid).toBeLessThanOrEqual(point.high)
    }
    expect(expectedAt(0).mid).toBe(0)
    expect(expectedAt(9999).mid).toBe(100)
    expect(expectedAt(182.625).mid).toBeCloseTo(50)
  })
})

describe('doz planı', () => {
  it('gün aşırı planı başlangıçtan sayar', () => {
    const m = med({ schedule: [{ from: '2026-03-01', timesPerDay: 1, everyNDays: 2 }] })
    expect(plannedSlots(m, '2026-02-28')).toBe(0)
    expect(plannedSlots(m, '2026-03-01')).toBe(1)
    expect(plannedSlots(m, '2026-03-02')).toBe(0)
    expect(plannedSlots(m, '2026-03-03')).toBe(1)
  })

  it('ara verilen günler eksik doz sayılmaz', () => {
    const paused = med({
      schedule: withPlan(med().schedule, { ...activePlan(med()), paused: true }, '2026-03-03'),
    })
    expect(isStopped(paused)).toBe(true)
    expect(plannedSlots(paused, '2026-03-02')).toBe(2)
    expect(plannedSlots(paused, '2026-03-03')).toBe(0)

    const resumed = med({
      schedule: withPlan(paused.schedule, { ...activePlan(paused), paused: false }, '2026-03-10'),
    })
    expect(isStopped(resumed)).toBe(false)
    const doses: DoseLog = {
      '2026-03-01': { m: [0, 1] },
      '2026-03-02': { m: [0, 1] },
      '2026-03-10': { m: [0, 1] },
    }
    expect(tally([resumed], doses, '2026-03-01', '2026-03-10', '2026-03-11')).toEqual({
      planned: 6,
      taken: 6,
      ratio: 1,
    })
    expect(streak([resumed], doses, '2026-03-11')).toBe(3)
    expect(weeklyRate(resumed, doses, '2026-03-11')).toBeCloseTo((6 / 4) * 7)
  })

  it('aynı gün ara verip dönmek yeni kayıt açmaz', () => {
    const plan = activePlan(med())
    const paused = withPlan(med().schedule, { ...plan, paused: true }, '2026-03-05')
    const back = withPlan(paused, { ...plan, paused: false }, '2026-03-05')
    expect(back).toHaveLength(2)
    expect(back[1]).toMatchObject({ from: '2026-03-05', timesPerDay: 2, everyNDays: 1, paused: false })
  })

  it('başladığı gün ara verilen ilacın planı kaybolmaz', () => {
    const first = med()
    const paused = med({ schedule: withPlan(first.schedule, { ...activePlan(first), paused: true }, '2026-03-01') })
    expect(plannedSlots(paused, '2026-03-01')).toBe(0)
    const resumed = med({ schedule: withPlan(paused.schedule, { ...activePlan(paused), paused: false }, '2026-03-04') })
    expect(activePlan(resumed)).toMatchObject({ timesPerDay: 2, everyNDays: 1 })
    expect(plannedSlots(resumed, '2026-03-04')).toBe(2)
  })

  it('aynı gün başlayan ilacın planı yeni kayıt açmadan değişir', () => {
    expect(withPlan(med().schedule, { timesPerDay: 1, everyNDays: 2 }, '2026-03-01')).toEqual([
      { from: '2026-03-01', timesPerDay: 1, everyNDays: 2 },
    ])
  })

  it('plan değişince geçmiş günler eski plana göre kalır', () => {
    const m = med({
      schedule: [
        { from: '2026-03-01', timesPerDay: 2, everyNDays: 1 },
        { from: '2026-03-03', timesPerDay: 1, everyNDays: 1 },
      ],
    })
    expect(plannedSlots(m, '2026-03-02')).toBe(2)
    expect(plannedSlots(m, '2026-03-03')).toBe(1)
    const doses: DoseLog = { '2026-03-02': { m: [0, 1] }, '2026-03-03': { m: [0] } }
    expect(tally([m], doses, '2026-03-02', '2026-03-03', '2026-03-10')).toMatchObject({ planned: 3, taken: 3 })
  })

  it('kullanım metnini Türkçe yazar', () => {
    expect(scheduleLabel({ timesPerDay: 2, everyNDays: 1 })).toBe('Günde 2 kez')
    expect(scheduleLabel({ timesPerDay: 1, everyNDays: 1 })).toBe('Günde bir kez')
    expect(scheduleLabel({ timesPerDay: 1, everyNDays: 2 })).toBe('Gün aşırı, tek doz')
  })
})

describe('uyum', () => {
  const m = med()
  const doses: DoseLog = {
    '2026-03-01': { m: [0, 1] },
    '2026-03-02': { m: [0] },
    '2026-03-03': { m: [1] },
    '2026-03-04': { m: [0] },
  }

  it('geçmiş günlerde alınmayan dozu eksik sayar', () => {
    expect(tally([m], doses, '2026-03-01', '2026-03-03', '2026-03-10')).toEqual({
      planned: 6,
      taken: 4,
      ratio: 4 / 6,
    })
  })

  it('bugünün bekleyen dozunu cezalandırmaz', () => {
    expect(tally([m], doses, '2026-03-01', '2026-03-04', '2026-03-04')).toEqual({
      planned: 7,
      taken: 5,
      ratio: 5 / 7,
    })
  })

  it('gelecek günleri saymaz', () => {
    expect(tally([m], doses, '2026-03-01', '2026-03-31', '2026-03-02').planned).toBe(3)
  })

  it('plan yoksa oran boş döner, sıfır değil', () => {
    expect(tally([], doses, '2026-03-01', '2026-03-03', '2026-03-10').ratio).toBeNull()
    expect(dayRatio([m], doses, '2026-02-01')).toBeNull()
  })

  it('kayıtlı fazla sırayı plana göre keser', () => {
    const extra: DoseLog = { '2026-03-02': { m: [0, 1, 2] } }
    expect(tally([m], extra, '2026-03-02', '2026-03-02', '2026-03-10').taken).toBe(2)
  })

  it('seriyi ilk eksik günde bitirir', () => {
    const full: DoseLog = {
      '2026-03-01': { m: [0] },
      '2026-03-02': { m: [0, 1] },
      '2026-03-03': { m: [0, 1] },
    }
    expect(streak([m], full, '2026-03-04')).toBe(2)
    expect(streak([m], { ...full, '2026-03-04': { m: [0, 1] } }, '2026-03-04')).toBe(3)
  })

  it('gün aşırı planda boş gün seriyi bozmaz', () => {
    const every = med({ schedule: [{ from: '2026-03-01', timesPerDay: 1, everyNDays: 2 }] })
    const log: DoseLog = { '2026-03-01': { m: [0] }, '2026-03-03': { m: [0] }, '2026-03-05': { m: [0] } }
    expect(streak([every], log, '2026-03-06')).toBe(3)
  })

  it('sabah ve akşamı ayrı ölçer', () => {
    const [morning, evening] = slotTally(m, doses, '2026-03-04')
    expect(morning).toMatchObject({ planned: 3, taken: 2 })
    expect(evening).toMatchObject({ planned: 3, taken: 2 })
  })

  it('kaçan dozu haftanın gününe yazar', () => {
    const rows = weekdayMisses([m], {}, '2026-03-02', '2026-03-04')
    expect(rows[0]).toMatchObject({ planned: 2, missed: 2 })
    expect(rows[1]).toMatchObject({ planned: 2, missed: 2 })
    expect(rows[2]).toMatchObject({ planned: 0, missed: 0 })
  })

  it('gerçekleşen haftalık kullanımı hesaplar', () => {
    const log: DoseLog = {}
    for (const date of eachDay('2026-03-01', '2026-03-07')) log[date] = { m: [0, 1] }
    expect(weeklyRate(m, log, '2026-03-08')).toBeCloseTo(12.25)
  })

  it('pencereyi ilacın başlangıcından önceye taşırmaz', () => {
    expect(windowTally([m], {}, 30, '2026-03-03').planned).toBe(4)
  })
})

describe('yıkama ve kabuk', () => {
  const surgery = '2026-03-01'

  it('yıkama aralıklarını sırasız girişten hesaplar', () => {
    const stats = washStats(
      surgery,
      [
        { date: '2026-03-06', note: '' },
        { date: '2026-03-03', note: '' },
        { date: '2026-03-04', note: '' },
      ],
      '2026-03-08',
    )
    expect(stats.firstDay).toBe(2)
    expect(stats.rows.map((row) => row.gap)).toEqual([null, 1, 2])
    expect(stats.averageGap).toBe(1.5)
    expect(stats.shortestGap).toBe(1)
    expect(stats.longestGap).toBe(2)
    expect(stats.daysSinceLast).toBe(2)
  })

  it('tek yıkamada aralık üretmez', () => {
    const stats = washStats(surgery, [{ date: '2026-03-03', note: '' }], '2026-03-03')
    expect(stats.averageGap).toBeNull()
    expect(stats.longestGap).toBeNull()
  })

  it('ilk iki hafta ile sonrasını ayırır', () => {
    const stats = washStats(
      surgery,
      [
        { date: '2026-03-14', note: '' },
        { date: '2026-03-15', note: '' },
        { date: '2026-03-18', note: '' },
      ],
      '2026-03-20',
    )
    expect(stats.earlyAverageGap).toBe(1)
    expect(stats.lateAverageGap).toBe(3)
  })

  it('yıkama aralığını haftalara dağıtır', () => {
    const { rows } = washStats(
      surgery,
      [
        { date: '2026-03-03', note: '' },
        { date: '2026-03-04', note: '' },
        { date: '2026-03-07', note: '' },
        { date: '2026-03-08', note: '' },
        { date: '2026-03-12', note: '' },
      ],
      '2026-03-20',
    )
    expect(weeklyWashGaps(rows)).toEqual([
      { week: 1, averageGap: 2, washes: 2 },
      { week: 2, averageGap: 2.5, washes: 2 },
    ])
  })

  it('kabuk dökümünü ameliyat gününe göre sayar', () => {
    const stats = scabStats(surgery, { start: '2026-03-09', end: '2026-03-13' }, '2026-03-20')
    expect(stats).toMatchObject({ status: 'tamam', startDay: 8, endDay: 12, durationDays: 5, timing: 'tipik' })
  })

  it('kabuk zamanlamasını sınıflar', () => {
    expect(scabStats(surgery, { start: null, end: '2026-03-08' }, '2026-03-20').timing).toBe('erken')
    expect(scabStats(surgery, { start: null, end: '2026-03-16' }, '2026-03-20').timing).toBe('gec')
  })

  it('14. günü geçen açık kabuğu işaretler', () => {
    expect(scabStats(surgery, { start: '2026-03-09', end: null }, '2026-03-16').overdue).toBe(true)
    expect(scabStats(surgery, { start: '2026-03-09', end: null }, '2026-03-15').overdue).toBe(false)
  })
})

describe('verimlilik', () => {
  const surgery = '2026-01-01'
  const finasterid = med({
    id: 'f',
    name: 'Finasterid',
    schedule: [{ from: surgery, timesPerDay: 1, everyNDays: 1 }],
  })

  const state = (checkIns: CheckIn[], takenDays: (date: string) => boolean): AppState => {
    const doses: DoseLog = {}
    for (const date of eachDay(surgery, '2026-12-31')) if (takenDays(date)) doses[date] = { f: [0] }
    return {
      ...EMPTY_STATE,
      surgery: {
        date: surgery,
        clinic: '',
        doctor: '',
        city: '',
        clinicPhone: '',
        graftCount: 3000,
        graftMap: {},
        technique: 'DHI',
        areas: [],
        note: '',
      },
      meds: [finasterid],
      doses,
      checkIns,
    }
  }

  it('net ilerlemeden doğal eğriyi çıkarır', () => {
    const rows = monthRows(
      state([checkIn('2026-05-15', 25), checkIn('2026-06-15', 40)], () => true),
      '2026-08-20',
    )
    const [may, june] = [rows[4], rows[5]]
    const expectedMay = expectedAt(diffDays(surgery, '2026-05-15')).mid
    const expectedJune = expectedAt(diffDays(surgery, '2026-06-15')).mid
    expect(may.gap).toBeCloseTo(25 - expectedMay)
    expect(may.net).toBeNull()
    expect(june.net).toBeCloseTo(40 - expectedJune - (25 - expectedMay))
  })

  it('ölçüm atlanan ayda neti aya böler', () => {
    const rows = monthRows(
      state([checkIn('2026-02-15', 10), checkIn('2026-04-15', 30)], () => true),
      '2026-05-20',
    )
    const gapA = 10 - expectedAt(diffDays(surgery, '2026-02-15')).mid
    const gapB = 30 - expectedAt(diffDays(surgery, '2026-04-15')).mid
    expect(rows[3].net).toBeCloseTo((gapB - gapA) / 2)
  })

  it('dönen ay henüz bitmediyse tamamlanmış sayılmaz', () => {
    const rows = monthRows(state([], () => true), '2026-03-15')
    expect(rows.map((row) => row.complete)).toEqual([true, true, false])
  })

  const row = (n: number, ratio: number, net: number | null, complete = true): MonthRow => ({
    kind: 'month',
    n,
    start: '',
    end: '',
    complete,
    adherence: { planned: 10, taken: 10, ratio },
    perMed: { f: { planned: 10, taken: 10, ratio } },
    washes: 0,
    checkIns: [],
    score: null,
    expectedMid: null,
    gap: null,
    net,
  })

  it('az veriyle hüküm vermez', () => {
    expect(medEfficacy([row(1, 0.9, 5), row(2, 0.5, 1)], 'f').verdict).toBe('yetersiz')
  })

  it('hep düzenliyse karşılaştırma yapmaz', () => {
    const result = medEfficacy([row(1, 0.9, 5), row(2, 0.95, 1), row(3, 1, 3)], 'f')
    expect(result.verdict).toBe('karsilastirma-yok')
    expect(result.regular.averageNet).toBe(3)
    expect(result.diff).toBeNull()
  })

  it('düzenli ayları düzensizlerle karşılaştırır', () => {
    const result = medEfficacy([row(1, 0.9, 6), row(2, 0.5, 0), row(3, 1, 4), row(4, 0.6, 2)], 'f')
    expect(result.verdict).toBe('olumlu')
    expect(result.regular).toEqual({ months: 2, averageNet: 5 })
    expect(result.irregular).toEqual({ months: 2, averageNet: 1 })
    expect(result.diff).toBe(4)
  })

  it('küçük farkı belirsiz sayar, %80 eşiğini düzenli kabul eder', () => {
    const result = medEfficacy([row(1, 0.8, 3), row(2, 0.5, 2), row(3, 1, 3)], 'f')
    expect(result.regular.months).toBe(2)
    expect(result.verdict).toBe('belirsiz')
  })

  it('biten ayda negatif ilişkiyi gizlemez', () => {
    expect(medEfficacy([row(1, 0.9, -2), row(2, 0.5, 4), row(3, 1, -2)], 'f').verdict).toBe('olumsuz')
  })

  it('devam eden ayı hesaba katmaz', () => {
    expect(medEfficacy([row(1, 0.9, 6), row(2, 0.5, 0), row(3, 1, 4, false)], 'f').verdict).toBe('yetersiz')
  })

  const multiRow = (n: number, a: number, b: number, net: number): MonthRow => ({
    ...row(n, 0.9, net),
    perMed: {
      a: { planned: 10, taken: 10, ratio: a },
      b: { planned: 10, taken: 10, ratio: b },
    },
  })

  it('aynı düzende kullanılan ilaçların etkisini ayırmaya çalışmaz', () => {
    const rows = [multiRow(1, 0.9, 0.95, 6), multiRow(2, 0.5, 0.6, 0), multiRow(3, 1, 0.9, 4)]
    const groups = groupEfficacy(rows, [{ id: 'a' }, { id: 'b' }])
    expect(groups).toHaveLength(1)
    expect(groups[0].meds).toHaveLength(2)
    expect(groups[0].entangled).toBe(true)
  })

  it('farklı aylarda aksayan ilaçları ayrı değerlendirir', () => {
    const rows = [multiRow(1, 0.9, 0.5, 6), multiRow(2, 0.5, 0.9, 0), multiRow(3, 1, 0.9, 4)]
    const groups = groupEfficacy(rows, [{ id: 'a' }, { id: 'b' }])
    expect(groups).toHaveLength(2)
    expect(groups.every((group) => !group.entangled)).toBe(true)
    expect(groups[0].result.verdict).toBe('olumlu')
    expect(groups[1].result.verdict).toBe('olumsuz')
  })

  it('veri yetersizken ilaçları dolaşık saymaz', () => {
    const groups = groupEfficacy([multiRow(1, 0.9, 0.9, 6)], [{ id: 'a' }, { id: 'b' }])
    expect(groups[0].entangled).toBe(false)
  })

  it('ölçümü beklenen aralığa göre yerleştirir', () => {
    const date = addMonths(surgery, 6)
    const band = expectedAt(diffDays(surgery, date))
    expect(positionOf(surgery, checkIn(date, band.mid))).toBe('aralikta')
    expect(positionOf(surgery, checkIn(date, band.high + 1))).toBe('ileride')
    expect(positionOf(surgery, checkIn(date, band.low - 1))).toBe('geride')
  })

  it('özet cümleyi uyum ve ölçüme göre seçer', () => {
    expect(readingOf(0.9, 'aralikta')?.tone).toBe('iyi')
    expect(readingOf(0.9, 'geride')?.tone).toBe('dikkat')
    expect(readingOf(0.5, 'ileride')?.title).toBe('İlerleme yolunda ama dozlar aksıyor')
    expect(readingOf(null, 'ileride')).toBeNull()
  })
})

describe('biçim', () => {
  it('yüzdeyi Türkçe yazar', () => {
    expect(fmtRatio(0.92)).toBe('%92')
    expect(fmtRatio(null)).toBe('–')
    expect(fmtScore(35)).toBe('%35')
  })

  it('işaretli sayıda gerçek eksi kullanır', () => {
    expect(fmtSigned(2.34)).toBe('+2,3')
    expect(fmtSigned(-2.34)).toBe('−2,3')
    expect(fmtSigned(0.01)).toBe('0')
  })
})

describe('yedek', () => {
  const state = buildDemoState('2026-10-31')

  it('yedeği kayıpsız geri okur', () => {
    const backup = buildBackup(state, { a: 'data:image/jpeg;base64,AA' })
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.state).toEqual(state)
    expect(parsed.photos).toEqual({ a: 'data:image/jpeg;base64,AA' })
  })

  it('yabancı ve bozuk dosyayı reddeder', () => {
    expect(() => parseBackup('{bozuk')).toThrow('Dosya okunamadı')
    expect(() => parseBackup('{"foo":1}')).toThrow('Kök yedeği değil')
    expect(() => parseBackup('{"app":"kok","state":{"version":3}}')).toThrow('bu sürümüyle')
    expect(() => parseBackup('{"app":"kok","state":{"version":1,"surgery":null}}')).toThrow('eksik')
  })
})

describe('örnek veri', () => {
  it('her çalıştırmada aynı sonucu üretir', () => {
    expect(buildDemoState('2026-10-31')).toEqual(buildDemoState('2026-10-31'))
  })

  it('gelecekte kayıt üretmez', () => {
    const state = buildDemoState('2026-10-31')
    expect(Object.keys(state.doses).every((date) => date <= '2026-10-31')).toBe(true)
    expect(state.washes.every((wash) => wash.date <= '2026-10-31')).toBe(true)
    expect(state.checkIns.every((entry) => entry.date <= '2026-10-31')).toBe(true)
  })
})
