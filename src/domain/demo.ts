import { plannedSlots } from './adherence'
import { addDays, addMonths, eachDay } from './dates'
import { dayNumber, expectedAt, monthNumber } from './timeline'
import { EMPTY_STATE, type AppState, type CheckIn, type DoseLog, type ISODate, type Medication, type Wash } from './types'

/** Aynı örnek veriyi üretmek için sabit tohumlu sayı üreteci. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

/** Aya göre doz alma olasılığı: üçüncü ayda düzen bozulup sonra toparlanıyor. */
const MONTHLY_DISCIPLINE = [0.97, 0.95, 0.62, 0.68, 0.93, 0.96, 0.95]

export const buildDemoState = (today: ISODate): AppState => {
  const random = seeded(20260331)
  const surgeryDate = addDays(addMonths(today, -6), -9)

  const meds: Medication[] = [
    {
      id: 'ornek-minoksidil',
      name: 'Minoksidil',
      kind: 'ilac',
      dose: '%5 köpük, 1 ml',
      schedule: [{ from: addDays(surgeryDate, 21), timesPerDay: 2, everyNDays: 1 }],
    },
    {
      id: 'ornek-finasterid',
      name: 'Finasterid',
      kind: 'ilac',
      dose: '1 mg tablet',
      schedule: [{ from: addDays(surgeryDate, 7), timesPerDay: 1, everyNDays: 1 }],
    },
    {
      id: 'ornek-biotin',
      name: 'Biotin',
      kind: 'takviye',
      dose: '5000 mcg',
      schedule: [{ from: addDays(surgeryDate, 7), timesPerDay: 1, everyNDays: 1 }],
    },
  ]

  const doses: DoseLog = {}
  for (const date of eachDay(surgeryDate, addDays(today, -1))) {
    const month = monthNumber(surgeryDate, date)
    const discipline = MONTHLY_DISCIPLINE[Math.min(month, MONTHLY_DISCIPLINE.length) - 1]
    for (const med of meds) {
      const slots = plannedSlots(med, date)
      const taken: number[] = []
      for (let slot = 0; slot < slots; slot += 1) {
        // Akşam dozu sabaha göre daha sık aksıyor.
        const chance = slot === 1 ? discipline - 0.12 : discipline
        if (random() < chance) taken.push(slot)
      }
      if (taken.length) (doses[date] ??= {})[med.id] = taken
    }
  }

  const washes: Wash[] = []
  washes.push({ date: addDays(surgeryDate, 2), note: 'İlk yıkama klinikte yapıldı' })
  for (let day = 3; day <= 14; day += 1) washes.push({ date: addDays(surgeryDate, day), note: '' })
  for (let day = 16; addDays(surgeryDate, day) <= today; day += random() < 0.5 ? 2 : 3) {
    washes.push({ date: addDays(surgeryDate, day), note: '' })
  }

  const checkIns: CheckIn[] = []
  let drift = 0
  for (let week = 1; addDays(surgeryDate, week * 7 - 1) <= today; week += 1) {
    const date = addDays(surgeryDate, week * 7 - 1)
    const day = dayNumber(surgeryDate, date)
    const month = monthNumber(surgeryDate, date)
    const discipline = MONTHLY_DISCIPLINE[Math.min(month, MONTHLY_DISCIPLINE.length) - 1]
    drift += discipline >= 0.9 ? 0.5 : -0.75
    const fullness = Math.round(Math.max(0, Math.min(100, expectedAt(day).mid + drift + (random() - 0.5) * 2)) / 5) * 5
    checkIns.push({
      id: `ornek-olcum-${week}`,
      date,
      fullness,
      shedding: week < 3 ? 1 : week < 9 ? 3 : week < 13 ? 1 : 0,
      density: week % 4 === 0 && week >= 12 ? 18 + week : null,
      sideEffects: week < 3 ? ['Kaşıntı'] : week === 10 ? ['Sivilce (follikülit)'] : [],
      note: week === 6 ? 'Dökülme hızlandı, kliniğe sordum, beklenen dönemdeymiş.' : '',
      photoIds: [],
    })
  }

  return {
    ...EMPTY_STATE,
    demo: true,
    surgery: {
      date: surgeryDate,
      clinic: 'Örnek Klinik',
      doctor: '',
      city: 'İstanbul',
      graftCount: 3200,
      technique: 'DHI',
      areas: ['Ön saç çizgisi', 'Orta bölge'],
      note: '',
    },
    meds,
    doses,
    washes,
    scabs: { start: addDays(surgeryDate, 8), end: addDays(surgeryDate, 12) },
    checkIns,
  }
}
