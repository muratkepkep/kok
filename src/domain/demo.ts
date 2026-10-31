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
      dose: '%5 köpük',
      unit: 'ml',
      schedule: [{ from: addDays(surgeryDate, 21), timesPerDay: 2, everyNDays: 1, amount: 1 }],
      slotTimes: ['09:00', '21:30'],
      endDate: null,
      stock: { from: addDays(today, -40), units: 300, perDose: 1, alertDays: 7 },
      note: '',
    },
    {
      id: 'ornek-finasterid',
      name: 'Finasterid',
      kind: 'ilac',
      dose: 'Tablet',
      unit: 'mg',
      schedule: [{ from: addDays(surgeryDate, 7), timesPerDay: 1, everyNDays: 1, amount: 1 }],
      slotTimes: ['09:00'],
      endDate: null,
      stock: { from: addDays(today, -24), units: 28, perDose: 1, alertDays: 7 },
      note: '',
    },
    {
      id: 'ornek-biotin',
      name: 'Biotin',
      kind: 'takviye',
      dose: 'Tablet',
      unit: 'mcg',
      schedule: [{ from: addDays(surgeryDate, 7), timesPerDay: 1, everyNDays: 1, amount: 5000 }],
      slotTimes: ['13:00'],
      endDate: null,
      stock: null,
      note: '',
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
      photoAngles: {},
    })
  }

  const symptoms: AppState['symptoms'] = {}
  for (let day = 1; day <= 12; day += 1) {
    const level = day < 4 ? 2 : day < 8 ? 1 : 0
    symptoms[addDays(surgeryDate, day)] = {
      scores: { Ağrı: level, Şişlik: day < 6 ? level : 0, Kaşıntı: day > 5 ? 1 : 0 },
      flags: [],
      note: '',
    }
  }

  return {
    ...EMPTY_STATE,
    demo: true,
    surgery: {
      date: surgeryDate,
      clinic: 'Örnek Klinik',
      doctor: '',
      city: 'İstanbul',
      clinicPhone: '',
      graftCount: 3200,
      graftMap: { 'Ön saç çizgisi': 1800, 'Orta bölge': 1000, Tepe: 400 },
      technique: 'DHI',
      areas: ['Ön saç çizgisi', 'Orta bölge'],
      note: '',
    },
    meds,
    doses,
    washes,
    scabs: { start: addDays(surgeryDate, 8), end: addDays(surgeryDate, 12) },
    checkIns,
    symptoms,
    appointments: [
      { id: 'ornek-kontrol', kind: 'Kontrol', title: '6. ay kontrolü', date: addDays(today, 5), time: '14:00', note: '', done: false },
      { id: 'ornek-prp', kind: 'PRP', title: 'PRP seansı', date: addDays(today, 19), time: '11:30', note: '', done: false },
    ],
  }
}
