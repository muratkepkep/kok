import { plannedSlots, SLOT_NAMES, stockStatus } from './adherence'
import { washStats } from './care'
import { addDays, diffDays, localToday } from './dates'
import { CARE_RULES, ruleDaysOf } from './rules'
import { STAGES, weekNumber, weekPeriod } from './timeline'
import type { AppState, ISODate } from './types'

/** iOS en fazla 64 bekleyen bildirim tutar; biri yenileme uyarısına ayrılır. */
export const MAX_PENDING = 63
const HORIZON_DAYS = 14
const NAG_DAYS = 2
const NAG_COUNT = 3
const SYMPTOM_DAYS = 14
const MILESTONE_DAYS = [30, 100, 180, 270, 365, 545]

export type ReminderKind = 'dose' | 'nag' | 'wash' | 'checkIn' | 'symptom' | 'appointment' | 'rule' | 'stock' | 'milestone' | 'reopen'

export interface PlannedReminder {
  key: string
  at: Date
  kind: ReminderKind
  title: string
  body: string
  /** Bildirimden işaretlenecek dozlar. */
  doses?: { date: ISODate; medId: string; slot: number }[]
}

const toMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

const dateAt = (date: ISODate, time: string, shift = 0) => {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute + shift, 0, 0)
}

/** Gece yarısını aşan aralıkları da kapsar. */
export const inQuietHours = (at: Date, start: string, end: string) => {
  const minutes = at.getHours() * 60 + at.getMinutes()
  const from = toMinutes(start)
  const to = toMinutes(end)
  return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to
}

/** Bildirim kimliği: aynı anahtar her planlamada aynı sayıyı üretir. */
export const reminderId = (key: string) => {
  let hash = 0
  for (const char of key) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0
  return Math.abs(hash) % 2147483000 + 1
}

/**
 * Önümüzdeki günlerin bildirim planı. Saf hesaptır: dozlar işaretlendikçe yeniden
 * çalıştırılır, böylece alınmış doz için hatırlatma gitmez.
 */
export const planReminders = (state: AppState, now: Date): PlannedReminder[] => {
  const settings = state.reminders
  const surgery = state.surgery
  if (!settings.enabled || !surgery) return []

  const today = localToday(now)
  const plan: PlannedReminder[] = []
  const add = (item: PlannedReminder) => {
    if (item.at > now) plan.push(item)
  }

  if (settings.doses) {
    for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
      const date = addDays(today, offset)
      const groups = new Map<string, { label: string; dose: { date: ISODate; medId: string; slot: number } }[]>()
      for (const med of state.meds) {
        const slots = plannedSlots(med, date)
        const taken = state.doses[date]?.[med.id] ?? []
        for (let slot = 0; slot < slots; slot += 1) {
          if (taken.includes(slot)) continue
          const time = med.slotTimes[slot] ?? '09:00'
          const name = slots > 1 ? `${med.name} (${SLOT_NAMES[slots][slot]})` : med.name
          const group = groups.get(time) ?? []
          group.push({ label: name, dose: { date, medId: med.id, slot } })
          groups.set(time, group)
        }
      }
      for (const [time, group] of groups) {
        const names = group.map((item) => item.label).join(', ')
        const doses = group.map((item) => item.dose)
        const body = settings.hideDetails ? 'Planlı dozun var. Aldıysan işaretle.' : names
        add({ key: `doz:${date}:${time}`, at: dateAt(date, time), kind: 'dose', title: 'Doz zamanı', body, doses })
        if (settings.nag && offset < NAG_DAYS) {
          for (let round = 1; round <= NAG_COUNT; round += 1) {
            const at = dateAt(date, time, settings.nagMinutes * round)
            if (inQuietHours(at, settings.quietStart, settings.quietEnd)) continue
            add({
              key: `israr:${date}:${time}:${round}`,
              at,
              kind: 'nag',
              title: 'Doz hâlâ işaretlenmedi',
              body: settings.hideDetails ? 'Serini korumak için dozunu işaretle.' : `${names}: aldıysan işaretle`,
              doses,
            })
          }
        }
      }
    }
  }

  if (settings.wash) {
    const { daysSinceLast } = washStats(surgery.date, state.washes, today)
    const start = daysSinceLast === null ? 0 : Math.max(0, settings.washEveryDays - daysSinceLast)
    for (let offset = start; offset < start + 3; offset += 1) {
      const date = addDays(today, offset)
      if (date < surgery.date) continue
      add({ key: `yikama:${date}`, at: dateAt(date, settings.washTime), kind: 'wash', title: 'Yıkama zamanı', body: 'Kliniğinin talimatına göre yıka ve Kök\'e kaydet.' })
    }
  }

  if (settings.checkIn && today >= surgery.date) {
    const week = weekPeriod(surgery.date, weekNumber(surgery.date, today))
    const measured = state.checkIns.some((item) => item.date >= week.start && item.date <= week.end)
    for (let offset = 0; offset < 8; offset += 1) {
      const date = addDays(today, offset)
      const inNextWeek = date > week.end
      if (!inNextWeek && measured) continue
      const end = inNextWeek ? addDays(week.end, 7) : week.end
      if (diffDays(date, end) > 2) continue
      add({ key: `olcum:${date}`, at: dateAt(date, settings.checkInTime), kind: 'checkIn', title: 'Haftalık ölçüm', body: 'Fotoğrafını çek ve ilerlemeni kaydet.' })
    }
  }

  if (settings.symptoms) {
    for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
      const date = addDays(today, offset)
      const day = diffDays(surgery.date, date)
      if (day < 0 || day > SYMPTOM_DAYS || state.symptoms[date]) continue
      add({ key: `belirti:${date}`, at: dateAt(date, '20:30'), kind: 'symptom', title: 'Bugün nasılsın?', body: 'Ağrı, şişlik ve kızarıklığını 20 saniyede kaydet.' })
    }
  }

  if (settings.appointments) {
    for (const item of state.appointments) {
      if (item.done) continue
      const title = settings.hideDetails ? 'Randevun var' : item.title || item.kind
      add({ key: `randevu:${item.id}:gun`, at: dateAt(addDays(item.date, -1), '20:00'), kind: 'appointment', title: 'Yarın randevun var', body: title })
      add({ key: `randevu:${item.id}:saat`, at: dateAt(item.date, item.time, -120), kind: 'appointment', title: '2 saat sonra randevun var', body: title })
    }
  }

  if (settings.rules) {
    for (const rule of CARE_RULES) {
      const date = addDays(surgery.date, ruleDaysOf(rule, state.ruleDays))
      add({ key: `kural:${rule.id}`, at: dateAt(date, '10:00'), kind: 'rule', title: 'Bir kısıt daha bitti', body: `${rule.done}. Kliniğinin süresini kontrol et.` })
    }
  }

  if (settings.stock) {
    for (const med of state.meds) {
      const status = stockStatus(med, state.doses, today)
      if (!status?.low) continue
      const body = settings.hideDetails ? 'Bir ürününün stoğu bitmek üzere.' : `${med.name} için yaklaşık ${status.daysLeft} günlük stok kaldı.`
      add({ key: `stok:${med.id}:${today}`, at: dateAt(addDays(today, 1), '11:00'), kind: 'stock', title: 'Stok azalıyor', body })
    }
  }

  if (settings.milestones) {
    for (const day of MILESTONE_DAYS) {
      add({ key: `kilometre:${day}`, at: dateAt(addDays(surgery.date, day), '10:30'), kind: 'milestone', title: `${day}. gün`, body: 'Yeni bir kilometre taşına ulaştın. Fotoğrafını çek.' })
    }
    for (const stage of STAGES.slice(1)) {
      add({ key: `evre:${stage.fromDay}`, at: dateAt(addDays(surgery.date, stage.fromDay), '10:15'), kind: 'milestone', title: `Yeni evre: ${stage.title}`, body: stage.body })
    }
  }

  const unique = [...new Map(plan.map((item) => [item.key, item])).values()].sort((a, b) => a.at.getTime() - b.at.getTime())
  const kept = unique.slice(0, MAX_PENDING)
  // Uyarı son doz bildiriminin ardından gelir; uzak kilometre taşları doz planının bittiğini gizlemesin.
  const last = kept.filter((item) => item.kind === 'dose').at(-1)
  if (last) {
    kept.push({
      key: 'yenile',
      at: new Date(last.at.getTime() + 60 * 60 * 1000),
      kind: 'reopen',
      title: 'Hatırlatmaların bitmek üzere',
      body: 'Yeni hatırlatmalar için Kök\'ü aç.',
    })
  }
  return kept
}
