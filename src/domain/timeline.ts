import { addDays, addMonths, diffDays } from './dates'
import type { ISODate } from './types'

export const TRACKED_WEEKS = 78
export const TRACKED_MONTHS = 18
const DAYS_PER_MONTH = 30.4375

export interface Stage {
  title: string
  fromDay: number
  toDay: number
  body: string
}

// Klinik kaynaklarda yaygın verilen genel seyir; kişiye göre değişir.
export const STAGES: Stage[] = [
  {
    title: 'İlk günler',
    fromDay: 0,
    toDay: 3,
    body: 'Şişlik, gerginlik ve kızarıklık beklenir. Yatış ve yıkama için kliniğinin talimatını izle.',
  },
  {
    title: 'Kabuklanma',
    fromDay: 4,
    toDay: 9,
    body: 'Greftlerin çevresinde ince kabuklar oluşur. Kabukları elle koparma, yıkamalarla kendiliğinden yumuşar.',
  },
  {
    title: 'Kabuk dökümü',
    fromDay: 10,
    toDay: 14,
    body: 'Kabuklar çoğunlukla bu günlerde dökülür. Döküm başladığında ve bittiğinde Bakım sayfasına tarih gir.',
  },
  {
    title: 'Şok dökülme',
    fromDay: 15,
    toDay: 60,
    body: 'Ekilen saçların büyük bölümü dökülebilir. Bu beklenen bir evredir, kökler yerinde kalır.',
  },
  {
    title: 'Sessiz dönem',
    fromDay: 61,
    toDay: 100,
    body: 'Görünüm seyrek kalabilir ve küçük sivilceler çıkabilir. Yeni saçlar yüzeyin altında hazırlanıyor.',
  },
  {
    title: 'İlk çıkış',
    fromDay: 101,
    toDay: 150,
    body: 'İnce ve açık renkli saçlar çıkmaya başlar. Değişimi görmek için aynı ışıkta fotoğraf çek.',
  },
  {
    title: 'Dolgunlaşma',
    fromDay: 151,
    toDay: 270,
    body: 'Saçlar kalınlaşır ve yön kazanır. Sonucun yaklaşık yarısı altıncı ay civarında görülür.',
  },
  {
    title: 'Olgunlaşma',
    fromDay: 271,
    toDay: 365,
    body: 'Yoğunluk artmaya devam eder. Çoğu kişide on ikinci ayda sonuç büyük ölçüde yerleşir.',
  },
  {
    title: 'Son hâl',
    fromDay: 366,
    toDay: Number.POSITIVE_INFINITY,
    body: 'Tepe bölgesi 18 aya kadar gelişebilir. Son sonucu bu dönemin sonunda değerlendir.',
  },
]

export const stageAt = (day: number) =>
  STAGES.find((stage) => day >= stage.fromDay && day <= stage.toDay) ?? STAGES[0]

interface ExpectedPoint {
  month: number
  low: number
  mid: number
  high: number
}

/** Beklenen son sonucun yüzdesi olarak genel iyileşme eğrisi. */
export const EXPECTED_CURVE: ExpectedPoint[] = [
  { month: 0, low: 0, mid: 0, high: 0 },
  { month: 1, low: 0, mid: 2, high: 5 },
  { month: 2, low: 0, mid: 5, high: 10 },
  { month: 3, low: 5, mid: 10, high: 20 },
  { month: 4, low: 10, mid: 20, high: 30 },
  { month: 5, low: 25, mid: 35, high: 45 },
  { month: 6, low: 40, mid: 50, high: 60 },
  { month: 7, low: 50, mid: 60, high: 70 },
  { month: 8, low: 60, mid: 70, high: 80 },
  { month: 9, low: 70, mid: 80, high: 90 },
  { month: 10, low: 75, mid: 84, high: 92 },
  { month: 11, low: 78, mid: 87, high: 96 },
  { month: 12, low: 80, mid: 90, high: 100 },
  { month: 14, low: 85, mid: 94, high: 100 },
  { month: 16, low: 90, mid: 97, high: 100 },
  { month: 18, low: 92, mid: 100, high: 100 },
]

export const expectedAt = (day: number) => {
  const month = Math.max(0, day) / DAYS_PER_MONTH
  const last = EXPECTED_CURVE[EXPECTED_CURVE.length - 1]
  if (month >= last.month) return { low: last.low, mid: last.mid, high: last.high }
  const nextIndex = EXPECTED_CURVE.findIndex((point) => point.month > month)
  const a = EXPECTED_CURVE[nextIndex - 1]
  const b = EXPECTED_CURVE[nextIndex]
  const t = (month - a.month) / (b.month - a.month)
  const mix = (x: number, y: number) => x + (y - x) * t
  return { low: mix(a.low, b.low), mid: mix(a.mid, b.mid), high: mix(a.high, b.high) }
}

export const monthOfDay = (day: number) => day / DAYS_PER_MONTH

/** Ameliyat günü 0. gündür. */
export const dayNumber = (surgeryDate: ISODate, date: ISODate) => diffDays(surgeryDate, date)

/** 0–6. günler 1. hafta. Ameliyattan önceki tarihlerde 0. */
export const weekNumber = (surgeryDate: ISODate, date: ISODate) => {
  const day = dayNumber(surgeryDate, date)
  return day < 0 ? 0 : Math.floor(day / 7) + 1
}

/** Ameliyat gününden sonraki ay dönümleri esas alınır: 15 Mart – 14 Nisan 1. ay. */
export const monthNumber = (surgeryDate: ISODate, date: ISODate) => {
  if (date < surgeryDate) return 0
  const [sy, sm] = surgeryDate.split('-').map(Number)
  const [dy, dm] = date.split('-').map(Number)
  let elapsed = (dy - sy) * 12 + (dm - sm)
  while (addMonths(surgeryDate, elapsed) > date) elapsed -= 1
  return elapsed + 1
}

export interface Period {
  kind: 'week' | 'month'
  n: number
  start: ISODate
  end: ISODate
}

export const weekPeriod = (surgeryDate: ISODate, n: number): Period => {
  const start = addDays(surgeryDate, (n - 1) * 7)
  return { kind: 'week', n, start, end: addDays(start, 6) }
}

export const monthPeriod = (surgeryDate: ISODate, n: number): Period => ({
  kind: 'month',
  n,
  start: addMonths(surgeryDate, n - 1),
  end: addDays(addMonths(surgeryDate, n), -1),
})
