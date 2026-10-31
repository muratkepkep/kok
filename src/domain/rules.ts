import { addDays, diffDays } from './dates'
import type { ISODate } from './types'

export interface CareRule {
  id: string
  title: string
  /** Serbest kaldığında gösterilen ifade. */
  done: string
  days: number
  body: string
}

// Genel süreler; klinikten kliniğe değişir, kullanıcı kendi süresini girebilir.
export const CARE_RULES: CareRule[] = [
  { id: 'uyku', title: 'Başı yüksekte yatma', done: 'Normal yatışa dönebilirsin', days: 7, body: 'Şişliği azaltmak ve greftleri korumak için yastıkla yüksekte yatılır.' },
  { id: 'sapka', title: 'Şapka takmama', done: 'Bol şapka takılabilir', days: 10, body: 'Sıkan şapka ve bere greftlere sürtebilir.' },
  { id: 'alkol', title: 'Alkol kullanmama', done: 'Alkol kısıtı bitti', days: 14, body: 'Alkol kanamayı ve şişliği artırabilir.' },
  { id: 'sigara', title: 'Sigara kullanmama', done: 'Sigara kısıtı bitti', days: 14, body: 'Sigara kan dolaşımını azaltarak iyileşmeyi yavaşlatabilir.' },
  { id: 'spor', title: 'Ağır spor yapmama', done: 'Spora dönebilirsin', days: 30, body: 'Ter, darbe ve kan basıncı artışı iyileşmeyi etkileyebilir.' },
  { id: 'havuz', title: 'Deniz ve havuza girmeme', done: 'Deniz ve havuz serbest', days: 30, body: 'Klor, tuz ve bakteriler iyileşen deriyi tahriş edebilir.' },
  { id: 'sauna', title: 'Sauna ve hamama girmeme', done: 'Sauna ve hamam serbest', days: 30, body: 'Yoğun sıcak ve terleme iyileşen bölgeyi zorlar.' },
  { id: 'gunes', title: 'Doğrudan güneşe çıkmama', done: 'Güneş kısıtı bitti', days: 30, body: 'Ekim bölgesi korunmalı, dışarıda baskı yapmayan şapka kullanılır.' },
  { id: 'kesim', title: 'Saç kesimi', done: 'Saç kesimi yapılabilir', days: 30, body: 'İlk kesim için kliniğinin önerdiği zamanı bekle, önce makas tercih edilir.' },
  { id: 'boya', title: 'Saç boyası ve kimyasal', done: 'Boya ve kimyasal serbest', days: 90, body: 'Kimyasallar iyileşen deride tahrişe yol açabilir.' },
]

export interface RuleStatus extends CareRule {
  days: number
  customized: boolean
  until: ISODate
  remaining: number
  free: boolean
  /** Sürenin geçen kısmı, 0–1. */
  progress: number
}

export const ruleDaysOf = (rule: CareRule, overrides: Record<string, number>) => overrides[rule.id] ?? rule.days

export const ruleStatuses = (
  surgeryDate: ISODate,
  overrides: Record<string, number>,
  today: ISODate,
): RuleStatus[] => {
  const passed = diffDays(surgeryDate, today)
  return CARE_RULES.map((rule) => {
    const days = ruleDaysOf(rule, overrides)
    const until = addDays(surgeryDate, days)
    const remaining = Math.max(0, days - passed)
    return {
      ...rule,
      days,
      customized: overrides[rule.id] !== undefined,
      until,
      remaining,
      free: passed >= days,
      progress: days === 0 ? 1 : Math.max(0, Math.min(1, passed / days)),
    }
  }).sort((a, b) => Number(a.free) - Number(b.free) || a.remaining - b.remaining)
}
