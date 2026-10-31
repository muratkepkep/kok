import { Preferences } from '@capacitor/preferences'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { activePlan, withPlan } from './domain/adherence'
import { localToday } from './domain/dates'
import { migrate } from './domain/migrate'
import {
  EMPTY_STATE,
  type Appointment,
  type AppState,
  type CheckIn,
  type ISODate,
  type Medication,
  type ReminderSettings,
  type ScabLog,
  type Surgery,
  type SymptomLog,
} from './domain/types'

const STORAGE_KEY = 'kok:durum'

let state: AppState = EMPTY_STATE
let saveFailed = false
let pendingSave = Promise.resolve()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/**
 * Kayıtları ilk çizimden önce yükler. iPhone'da WebView depolaması sistem
 * tarafından silinebildiği için veri Preferences üzerinden yerel olarak tutulur.
 */
export const loadState = async () => {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY })
    if (value) state = migrate(JSON.parse(value) as Record<string, unknown>)
  } catch {
    // Depolama okunamazsa uygulama boş durumla açılır.
  }
}

const markSaved = (failed: boolean) => {
  if (saveFailed === failed) return
  saveFailed = failed
  notify()
}

const commit = (next: AppState) => {
  state = next
  notify()
  const value = JSON.stringify(next)
  // Yazmalar sıraya alınır; art arda dokunuşlarda eski durum yenisini ezemez.
  pendingSave = pendingSave
    .then(() => Preferences.set({ key: STORAGE_KEY, value }))
    .then(
      () => markSaved(false),
      () => markSaved(true),
    )
}

export const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getState = () => state
export const useAppState = () => useSyncExternalStore(subscribe, () => state)
export const useSaveFailed = () => useSyncExternalStore(subscribe, () => saveFailed)

/** Uygulama gece açık kalırsa gün değişimini yakalar. */
export const useToday = () => {
  const [today, setToday] = useState(localToday)
  useEffect(() => {
    const refresh = () => setToday(localToday())
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return today
}

const newId = () => crypto.randomUUID()

const updateMed = (id: string, change: (med: Medication) => Medication) =>
  commit({ ...state, meds: state.meds.map((med) => (med.id === id ? change(med) : med)) })

export const actions = {
  replaceAll(next: AppState) {
    commit(next)
  },

  saveSurgery(surgery: Surgery) {
    commit({ ...state, surgery })
  },

  saveMed(med: Medication) {
    const exists = state.meds.some((item) => item.id === med.id)
    commit({
      ...state,
      meds: exists ? state.meds.map((item) => (item.id === med.id ? med : item)) : [...state.meds, med],
    })
  },

  newMed(fields: Omit<Medication, 'id'>) {
    this.saveMed({ ...fields, id: newId() })
  },

  stopMed(id: string, today: ISODate) {
    updateMed(id, (med) => ({ ...med, schedule: withPlan(med.schedule, { ...activePlan(med), paused: true }, today) }))
  },

  resumeMed(id: string, today: ISODate) {
    updateMed(id, (med) => ({ ...med, schedule: withPlan(med.schedule, { ...activePlan(med), paused: false }, today) }))
  },

  /** Doz değişikliği bugünden başlar, eski doz geçmişte kalır. */
  setDoseAmount(id: string, amount: number, today: ISODate) {
    updateMed(id, (med) => ({ ...med, schedule: withPlan(med.schedule, { ...activePlan(med), amount }, today) }))
  },

  /** İlacı doz kayıtlarıyla birlikte siler. */
  deleteMed(id: string) {
    const doses = Object.fromEntries(
      Object.entries(state.doses).map(([date, byMed]) => {
        const { [id]: _removed, ...rest } = byMed
        return [date, rest]
      }),
    )
    commit({ ...state, meds: state.meds.filter((med) => med.id !== id), doses })
  },

  toggleDose(date: ISODate, medId: string, slot: number) {
    const current = state.doses[date]?.[medId] ?? []
    const next = current.includes(slot)
      ? current.filter((item) => item !== slot)
      : [...current, slot].sort((a, b) => a - b)
    commit({
      ...state,
      doses: { ...state.doses, [date]: { ...state.doses[date], [medId]: next } },
    })
  },

  /** Bildirimdeki "Aldım" düğmesi; zaten alınmış dozu değiştirmez. */
  markDoses(items: { date: ISODate; medId: string; slot: number }[]) {
    const doses = { ...state.doses }
    for (const { date, medId, slot } of items) {
      const current = doses[date]?.[medId] ?? []
      if (current.includes(slot)) continue
      doses[date] = { ...doses[date], [medId]: [...current, slot].sort((a, b) => a - b) }
    }
    commit({ ...state, doses })
  },

  /** Aynı güne ikinci yıkama eklenmez; yıkama aralığı gün üzerinden ölçülür. */
  addWash(date: ISODate, note = '') {
    if (state.washes.some((wash) => wash.date === date)) return
    commit({ ...state, washes: [...state.washes, { date, note }] })
  },

  removeWash(date: ISODate) {
    commit({ ...state, washes: state.washes.filter((wash) => wash.date !== date) })
  },

  saveScabs(scabs: ScabLog) {
    commit({ ...state, scabs })
  },

  saveCheckIn(entry: Omit<CheckIn, 'id'> & { id?: string }) {
    const saved: CheckIn = { ...entry, id: entry.id ?? newId() }
    const exists = state.checkIns.some((item) => item.id === saved.id)
    commit({
      ...state,
      checkIns: exists
        ? state.checkIns.map((item) => (item.id === saved.id ? saved : item))
        : [...state.checkIns, saved],
    })
  },

  deleteCheckIn(id: string) {
    commit({ ...state, checkIns: state.checkIns.filter((item) => item.id !== id) })
  },

  saveSymptoms(date: ISODate, log: SymptomLog) {
    commit({ ...state, symptoms: { ...state.symptoms, [date]: log } })
  },

  saveAppointment(entry: Omit<Appointment, 'id'> & { id?: string }) {
    const saved: Appointment = { ...entry, id: entry.id ?? newId() }
    const exists = state.appointments.some((item) => item.id === saved.id)
    commit({
      ...state,
      appointments: exists
        ? state.appointments.map((item) => (item.id === saved.id ? saved : item))
        : [...state.appointments, saved],
    })
  },

  deleteAppointment(id: string) {
    commit({ ...state, appointments: state.appointments.filter((item) => item.id !== id) })
  },

  setRuleDays(id: string, days: number | null) {
    const { [id]: _old, ...rest } = state.ruleDays
    commit({ ...state, ruleDays: days === null ? rest : { ...rest, [id]: days } })
  },

  saveReminders(change: Partial<ReminderSettings>) {
    commit({ ...state, reminders: { ...state.reminders, ...change } })
  },

  saveClinicNotes(clinicNotes: string) {
    commit({ ...state, clinicNotes })
  },
}
