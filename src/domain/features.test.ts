import { describe, expect, it } from 'vitest'
import { activePlan, amountLabel, doseHistory, plannedSlots, scheduleLabel, stockStatus, tally, withPlan } from './adherence'
import { badgesOf } from './badges'
import { parseBackup } from './backup'
import { buildDemoState } from './demo'
import { migrate, parseDose } from './migrate'
import { inQuietHours, MAX_PENDING, planReminders, reminderId } from './reminders'
import { buildReport } from './report'
import { ruleStatuses } from './rules'
import { hasRedFlag, needsAttention } from './symptoms'
import { DEFAULT_REMINDERS, EMPTY_STATE, type AppState, type DoseLog, type Medication } from './types'

const med = (over: Partial<Medication> = {}): Medication => ({
  id: 'm',
  name: 'Minoksidil',
  kind: 'ilac',
  dose: '%5',
  unit: 'ml',
  schedule: [{ from: '2026-03-01', timesPerDay: 2, everyNDays: 1, amount: 1 }],
  slotTimes: ['09:00', '21:00'],
  endDate: null,
  stock: null,
  note: '',
  ...over,
})

const stateWith = (over: Partial<AppState> = {}): AppState => ({
  ...EMPTY_STATE,
  surgery: {
    date: '2026-03-01',
    clinic: 'Klinik',
    doctor: '',
    city: '',
    clinicPhone: '',
    graftCount: 3000,
    graftMap: {},
    technique: 'DHI',
    areas: [],
    note: '',
  },
  meds: [med()],
  ...over,
})

describe('sürüm geçişi', () => {
  // Telefondaki gerçek kayıtların biçimi: birinci sürümde bu alanlar yoktu.
  const v1 = {
    version: 1,
    demo: false,
    surgery: { date: '2026-03-01', clinic: 'A', doctor: '', city: '', graftCount: 4000, technique: 'DHI', areas: [], note: '' },
    meds: [
      { id: 'a', name: 'Finasterid', kind: 'ilac', dose: '1 mg tablet', schedule: [{ from: '2026-03-02', timesPerDay: 1, everyNDays: 1 }] },
      { id: 'b', name: 'Minoksidil', kind: 'ilac', dose: '%5 köpük veya solüsyon', schedule: [{ from: '2026-03-02', timesPerDay: 2, everyNDays: 1 }] },
    ],
    doses: { '2026-03-02': { a: [0], b: [0, 1] } },
    washes: [{ date: '2026-03-03', note: 'klinik' }],
    scabs: { start: '2026-03-09', end: null },
    checkIns: [{ id: 'c', date: '2026-03-08', fullness: 5, shedding: 1, density: null, sideEffects: [], note: 'not', photoIds: ['p'] }],
  }

  it('eski kayıtların hiçbirini kaybetmez', () => {
    const state = migrate(v1)
    expect(state.version).toBe(2)
    expect(state.doses).toEqual(v1.doses)
    expect(state.washes).toEqual(v1.washes)
    expect(state.scabs).toEqual(v1.scabs)
    expect(state.checkIns[0]).toMatchObject({ note: 'not', photoIds: ['p'], photoAngles: {} })
    expect(state.surgery).toMatchObject({ graftCount: 4000, clinicPhone: '', graftMap: {} })
    expect(state.reminders).toEqual(DEFAULT_REMINDERS)
  })

  it('doz metninden miktarı çıkarır, geçmiş uyumu bozmaz', () => {
    const state = migrate(v1)
    const [finasterid, minoksidil] = state.meds
    expect(finasterid).toMatchObject({ unit: 'mg', slotTimes: ['09:00'], endDate: null, stock: null })
    expect(activePlan(finasterid).amount).toBe(1)
    expect(activePlan(minoksidil).amount).toBeNull()
    expect(minoksidil.slotTimes).toEqual(['09:00', '21:00'])
    expect(tally(state.meds, state.doses, '2026-03-02', '2026-03-02', '2026-03-10').ratio).toBe(1)
  })

  it('tekrar çalışınca değiştirmez', () => {
    const once = migrate(v1)
    expect(migrate(once as unknown as Record<string, unknown>)).toEqual(once)
  })

  it('eski yedeği de açar', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'kok', state: v1, photos: {} }))
    expect(parsed.state.version).toBe(2)
  })

  it('doz metnini ayrıştırır', () => {
    expect(parseDose('%5 köpük, 1 ml')).toEqual({ amount: 1, unit: 'ml' })
    expect(parseDose('0,5 mg')).toEqual({ amount: 0.5, unit: 'mg' })
    expect(parseDose('5000 mcg')).toEqual({ amount: 5000, unit: 'mcg' })
    expect(parseDose('Tablet')).toEqual({ amount: null, unit: null })
  })
})

describe('ilaç planı', () => {
  it('seçilen hafta günlerinde doz planlar', () => {
    // 2026-03-02 pazartesi.
    const m = med({ schedule: [{ from: '2026-03-01', timesPerDay: 1, everyNDays: 1, weekdays: [0, 2] }] })
    expect(plannedSlots(m, '2026-03-02')).toBe(1)
    expect(plannedSlots(m, '2026-03-03')).toBe(0)
    expect(plannedSlots(m, '2026-03-04')).toBe(1)
    expect(scheduleLabel(m.schedule[0])).toBe('Pzt, Çar, tek doz')
  })

  it('kür bitince doz planlamaz', () => {
    const m = med({ endDate: '2026-03-05' })
    expect(plannedSlots(m, '2026-03-05')).toBe(2)
    expect(plannedSlots(m, '2026-03-06')).toBe(0)
  })

  it('doz değişikliğini geçmişe yazar, eski günleri bozmaz', () => {
    const first = med()
    const changed = med({ schedule: withPlan(first.schedule, { ...activePlan(first), amount: 2 }, '2026-03-10') })
    expect(amountLabel(changed)).toBe('2 ml')
    expect(doseHistory(changed)).toEqual([
      { from: '2026-03-10', amount: 2 },
      { from: '2026-03-01', amount: 1 },
    ])
    expect(plannedSlots(changed, '2026-03-05')).toBe(2)
  })

  it('stoktan alınan dozu düşer ve bitişi hesaplar', () => {
    const m = med({ stock: { from: '2026-03-01', units: 20, perDose: 1, alertDays: 7 } })
    const doses: DoseLog = { '2026-03-01': { m: [0, 1] }, '2026-03-02': { m: [0] } }
    expect(stockStatus(m, doses, '2026-03-03')).toEqual({ remaining: 17, daysLeft: 8, low: false })
    const low = med({ stock: { from: '2026-03-01', units: 16, perDose: 1, alertDays: 7 } })
    expect(stockStatus(low, doses, '2026-03-03')?.low).toBe(true)
    expect(stockStatus(med(), doses, '2026-03-03')).toBeNull()
  })

  it('stok sıfırın altına inmez', () => {
    const m = med({ stock: { from: '2026-03-01', units: 1, perDose: 1, alertDays: 7 } })
    expect(stockStatus(m, { '2026-03-01': { m: [0, 1] } }, '2026-03-02')?.remaining).toBe(0)
  })
})

describe('hatırlatmalar', () => {
  const now = new Date(2026, 2, 10, 8, 0)

  it('dozu saatinde hatırlatır ve aynı saatteki ilaçları birleştirir', () => {
    const plan = planReminders(stateWith({ meds: [med(), med({ id: 'f', name: 'Finasterid', slotTimes: ['09:00', '21:00'] })] }), now)
    const first = plan.find((item) => item.kind === 'dose')
    expect(first?.at).toEqual(new Date(2026, 2, 10, 9, 0))
    expect(first?.body).toContain('Minoksidil (Sabah)')
    expect(first?.body).toContain('Finasterid (Sabah)')
    expect(first?.doses).toHaveLength(2)
  })

  it('alınmış doz için hatırlatma üretmez', () => {
    const doses: DoseLog = { '2026-03-10': { m: [0] } }
    const plan = planReminders(stateWith({ doses }), now)
    expect(plan.some((item) => item.key === 'doz:2026-03-10:09:00')).toBe(false)
    expect(plan.some((item) => item.key === 'doz:2026-03-10:21:00')).toBe(true)
  })

  it('işaretlenene kadar ısrar eder, gece sessiz saatine girmez', () => {
    const plan = planReminders(stateWith({ meds: [med({ slotTimes: ['09:00', '23:00'] })] }), now)
    const nags = plan.filter((item) => item.kind === 'nag')
    expect(nags.some((item) => item.key === 'israr:2026-03-10:09:00:1')).toBe(true)
    expect(nags.filter((item) => item.key.startsWith('israr:2026-03-10:23:00'))).toHaveLength(0)
  })

  it('geçmiş saatleri planlamaz', () => {
    const late = new Date(2026, 2, 10, 22, 0)
    expect(planReminders(stateWith(), late).every((item) => item.at > late)).toBe(true)
  })

  it('iOS sınırını aşmaz ve yenileme uyarısı bırakır', () => {
    const meds = Array.from({ length: 6 }, (_, index) => med({ id: `m${index}`, slotTimes: [`0${index + 1}:00`, `1${index}:30`] }))
    const plan = planReminders(stateWith({ meds }), now)
    expect(plan.length).toBeLessThanOrEqual(MAX_PENDING + 1)
    expect(plan.at(-1)?.kind).toBe('reopen')
    expect(new Set(plan.map((item) => reminderId(item.key))).size).toBe(plan.length)
  })

  it('gizli modda ilaç adını yazmaz', () => {
    const plan = planReminders(stateWith({ reminders: { ...DEFAULT_REMINDERS, hideDetails: true } }), now)
    expect(plan.filter((item) => item.doses).every((item) => !item.body.includes('Minoksidil'))).toBe(true)
  })

  it('kapalıyken hiçbir şey planlamaz', () => {
    expect(planReminders(stateWith({ reminders: { ...DEFAULT_REMINDERS, enabled: false } }), now)).toEqual([])
    expect(planReminders(stateWith({ surgery: null }), now)).toEqual([])
  })

  it('randevu ve kısıt bitişini hatırlatır', () => {
    const appointments = [{ id: 'r', kind: 'Kontrol' as const, title: '1. ay', date: '2026-03-12', time: '14:00', note: '', done: false }]
    const keys = planReminders(stateWith({ meds: [], appointments }), now).map((item) => item.key)
    expect(keys).toContain('randevu:r:gun')
    expect(keys).toContain('randevu:r:saat')
    expect(keys).toContain('kural:sapka')
  })

  it('ilk iki haftada belirti sorar, kaydedilen gün için sormaz', () => {
    const symptoms = { '2026-03-10': { scores: {}, flags: [], note: '' } }
    const keys = planReminders(stateWith({ meds: [], symptoms }), now).map((item) => item.key)
    expect(keys).not.toContain('belirti:2026-03-10')
    expect(keys).toContain('belirti:2026-03-11')
    expect(keys).not.toContain('belirti:2026-03-16')
  })

  it('sessiz saatler gece yarısını aşar', () => {
    expect(inQuietHours(new Date(2026, 2, 10, 23, 45), '23:30', '07:30')).toBe(true)
    expect(inQuietHours(new Date(2026, 2, 10, 6, 0), '23:30', '07:30')).toBe(true)
    expect(inQuietHours(new Date(2026, 2, 10, 12, 0), '23:30', '07:30')).toBe(false)
  })

  it('anahtardan kararlı kimlik üretir', () => {
    expect(reminderId('doz:2026-03-10:09:00')).toBe(reminderId('doz:2026-03-10:09:00'))
    expect(reminderId('a')).toBeGreaterThan(0)
  })
})

describe('kurallar ve belirtiler', () => {
  it('kalan günü sayar, kliniğin süresini önceler', () => {
    const rules = ruleStatuses('2026-03-01', { spor: 45 }, '2026-03-11')
    expect(rules.find((rule) => rule.id === 'uyku')).toMatchObject({ free: true, remaining: 0 })
    expect(rules.find((rule) => rule.id === 'alkol')).toMatchObject({ free: false, remaining: 4 })
    expect(rules.find((rule) => rule.id === 'spor')).toMatchObject({ days: 45, remaining: 35, customized: true })
    expect(rules.at(-1)?.free).toBe(true)
  })

  it('acil işareti ve şiddetli belirtiyi ayırır', () => {
    expect(hasRedFlag({ scores: {}, flags: ['Ateş veya titreme'], note: '' })).toBe(true)
    expect(needsAttention({ scores: { Ağrı: 3 }, flags: [], note: '' })).toBe(true)
    expect(needsAttention({ scores: { Ağrı: 2 }, flags: [], note: '' })).toBe(false)
    expect(needsAttention(undefined)).toBe(false)
  })
})

describe('rozet ve rapor', () => {
  it('rozetleri kayıtlardan hesaplar', () => {
    const state = buildDemoState('2026-10-31')
    const badges = badgesOf(state, '2026-10-31')
    expect(badges.find((badge) => badge.id === 'gun-100')?.done).toBe(true)
    expect(badges.find((badge) => badge.id === 'gun-365')?.done).toBe(false)
    expect(badges.find((badge) => badge.id === 'kabuk')?.done).toBe(true)
    expect(badges.every((badge) => badge.progress >= 0 && badge.progress <= 1)).toBe(true)
  })

  it('rapor kullanıcı metnini güvenli yazar', () => {
    const base = stateWith()
    const state = { ...base, surgery: { ...base.surgery!, clinic: '<script>x</script>' } }
    const html = buildReport(state, '2026-03-10')
    expect(html).not.toContain('<script>x')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('Minoksidil')
  })
})

describe('plan değişikliği', () => {
  const med: Medication = {
    id: 'm',
    name: 'Test',
    kind: 'ilac',
    dose: '',
    unit: 'mg',
    schedule: [{ from: '2026-01-01', timesPerDay: 1, everyNDays: 2, amount: 1 }],
    slotTimes: ['09:00'],
    endDate: null,
    stock: null,
    note: '',
  }

  it('doz değişince gün aşırı ritmi kaymaz', () => {
    const base = { ...med, schedule: [...med.schedule] }
    const changed = { ...base, schedule: withPlan(base.schedule, { ...activePlan(base), amount: 2 }, '2026-01-04') }
    expect(plannedSlots(changed, '2026-01-04')).toBe(0)
    expect(plannedSlots(changed, '2026-01-05')).toBe(1)
  })

  it('ara verilmiş ilacın dozu değişince ilaç yeniden başlamaz', () => {
    const base = { ...med, schedule: [...med.schedule] }
    const paused = { ...base, schedule: withPlan(base.schedule, { ...activePlan(base), paused: true }, '2026-01-03') }
    const changed = { ...paused, schedule: withPlan(paused.schedule, { ...activePlan(paused), amount: 2 }, '2026-01-05') }
    expect(plannedSlots(changed, '2026-01-07')).toBe(0)
  })
})
