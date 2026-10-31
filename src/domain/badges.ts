import { bestStreak } from './adherence'
import { scabStats } from './care'
import { diffDays } from './dates'
import type { AppState, ISODate } from './types'

export interface Badge {
  id: string
  title: string
  body: string
  /** 0–1 ilerleme. */
  progress: number
  done: boolean
  value: string
}

const milestone = (id: string, title: string, body: string, current: number, target: number, unit: string): Badge => ({
  id,
  title,
  body,
  progress: Math.max(0, Math.min(1, current / target)),
  done: current >= target,
  value: `${Math.min(Math.max(0, current), target)}/${target} ${unit}`,
})

export const badgesOf = (state: AppState, today: ISODate): Badge[] => {
  const surgeryDate = state.surgery?.date ?? today
  const day = diffDays(surgeryDate, today)
  const best = bestStreak(state.meds, state.doses, today)
  const measures = state.checkIns.length
  const photos = state.checkIns.reduce((sum, item) => sum + item.photoIds.length, 0)
  const scab = scabStats(surgeryDate, state.scabs, today)

  return [
    milestone('seri-7', 'İlk hafta', '7 gün boyunca hiçbir dozu kaçırma', best, 7, 'gün'),
    milestone('seri-30', 'Demir disiplin', '30 günlük kesintisiz seri', best, 30, 'gün'),
    milestone('seri-100', 'Efsane seri', '100 günlük kesintisiz seri', best, 100, 'gün'),
    milestone('gun-30', 'İlk ay', 'Ameliyattan 30 gün geçti', day, 30, 'gün'),
    milestone('gun-100', '100 gün', 'Saçların uyanmaya başlıyor', day, 100, 'gün'),
    milestone('gun-180', 'Yarı yol', 'Altı ayı geride bıraktın', day, 180, 'gün'),
    milestone('gun-365', 'Bir yıl', 'Sonuç büyük ölçüde yerleşti', day, 365, 'gün'),
    milestone('olcum-10', 'Veri avcısı', '10 ölçüm kaydet', measures, 10, 'ölçüm'),
    milestone('foto-10', 'Zaman kapsülü', '10 fotoğraf arşivle', photos, 10, 'foto'),
    milestone('kabuk', 'Temiz başlangıç', 'Kabuk dökümünü tamamla', scab.status === 'tamam' ? 1 : 0, 1, 'kayıt'),
  ]
}
