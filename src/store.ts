import { Preferences } from '@capacitor/preferences'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { activePlan, withPlan } from './domain/adherence'
import { localToday } from './domain/dates'
import { EMPTY_STATE, type AppState, type CheckIn, type Medication, type ScabLog, type Surgery } from './domain/types'

const STORAGE_KEY = 'kok:durum'

let state = EMPTY_STATE
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
    if (value) state = { ...EMPTY_STATE, ...(JSON.parse(value) as AppState) }
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

const subscribe = (listener: () => void) => {
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

  stopMed(id: string, today: string) {
    commit({
      ...state,
      meds: state.meds.map((med) =>
        med.id === id ? { ...med, schedule: withPlan(med.schedule, { ...activePlan(med), paused: true }, today) } : med,
      ),
    })
  },

  resumeMed(id: string, today: string) {
    commit({
      ...state,
      meds: state.meds.map((med) =>
        med.id === id ? { ...med, schedule: withPlan(med.schedule, { ...activePlan(med), paused: false }, today) } : med,
      ),
    })
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

  toggleDose(date: string, medId: string, slot: number) {
    const current = state.doses[date]?.[medId] ?? []
    const next = current.includes(slot)
      ? current.filter((item) => item !== slot)
      : [...current, slot].sort((a, b) => a - b)
    commit({
      ...state,
      doses: { ...state.doses, [date]: { ...state.doses[date], [medId]: next } },
    })
  },

  /** Aynı güne ikinci yıkama eklenmez; yıkama aralığı gün üzerinden ölçülür. */
  addWash(date: string, note = '') {
    if (state.washes.some((wash) => wash.date === date)) return
    commit({ ...state, washes: [...state.washes, { date, note }] })
  },

  removeWash(date: string) {
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
}
