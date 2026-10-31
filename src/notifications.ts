import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { planReminders, reminderId, type PlannedReminder, type ReminderKind } from './domain/reminders'
import { actions, getState, subscribe } from './store'

const DOSE_ACTIONS = 'KOK_DOZ'
const SNOOZE_MINUTES = 30
const native = Capacitor.isNativePlatform()

const ROUTES: Record<ReminderKind, string> = {
  dose: 'bugun',
  nag: 'bugun',
  wash: 'bakim',
  checkIn: 'surec',
  symptom: 'belirti',
  appointment: 'randevu',
  rule: 'kurallar',
  stock: 'ilaclar',
  milestone: 'bugun',
  reopen: 'bugun',
}

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'web'

export const notificationStatus = async (): Promise<PermissionState> => {
  if (!native) return 'web'
  const { display } = await LocalNotifications.checkPermissions()
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
}

export const requestNotifications = async (): Promise<PermissionState> => {
  if (!native) return 'web'
  const { display } = await LocalNotifications.requestPermissions()
  await syncReminders()
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
}

const toNotification = (item: PlannedReminder) => ({
  id: reminderId(item.key),
  title: item.title,
  body: item.body,
  schedule: { at: item.at, allowWhileIdle: true },
  actionTypeId: item.doses ? DOSE_ACTIONS : undefined,
  extra: { kind: item.kind, doses: item.doses ?? null },
})

/** Bekleyen tüm bildirimleri güncel kayıtlara göre yeniden kurar. */
export const syncReminders = async () => {
  if (!native) return
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return
  const { notifications } = await LocalNotifications.getPending()
  // Ertelenen bildirim plandan gelmez, yeniden kurulumda silinmemelidir.
  const planned = notifications.filter(({ extra }) => !(extra as { snoozed?: boolean } | undefined)?.snoozed)
  if (planned.length) {
    await LocalNotifications.cancel({ notifications: planned.map(({ id }) => ({ id })) })
  }
  const state = getState()
  const plan = state.demo ? [] : planReminders(state, new Date())
  if (plan.length) await LocalNotifications.schedule({ notifications: plan.map(toNotification) })
}

let timer: number | undefined
const queueSync = () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => void syncReminders().catch(() => undefined), 800)
}

/** Bildirim düğmelerini ve kayıt değişince yeniden planlamayı başlatır. */
export const startReminders = async () => {
  if (!native) return
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: DOSE_ACTIONS,
        actions: [
          { id: 'aldim', title: 'Aldım', foreground: true },
          { id: 'ertele', title: `${SNOOZE_MINUTES} dk ertele`, foreground: false },
        ],
      },
    ],
  })

  await LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
    const extra = notification.extra as { kind?: ReminderKind; doses?: PlannedReminder['doses'] } | undefined
    if (actionId === 'aldim' && extra?.doses) {
      actions.markDoses(extra.doses)
    } else if (actionId === 'ertele') {
      void LocalNotifications.schedule({
        notifications: [
          {
            ...notification,
            id: reminderId(`ertele:${notification.id}:${Date.now()}`),
            extra: { ...extra, snoozed: true },
            schedule: { at: new Date(Date.now() + SNOOZE_MINUTES * 60_000), allowWhileIdle: true },
          },
        ],
      })
      return
    }
    window.location.hash = ROUTES[extra?.kind ?? 'dose']
  })

  // Önceki sürümden gelenler ilk açılış adımını görmez, izin burada istenir.
  const { surgery, demo } = getState()
  if (surgery && !demo && (await notificationStatus()) === 'prompt') await requestNotifications()

  subscribe(queueSync)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') queueSync()
  })
  queueSync()
}
