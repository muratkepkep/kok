import { DEFAULT_SLOT_TIMES } from './migrate'
import type { DoseUnit, ISODate, Medication, MedKind } from './types'

export interface CatalogItem {
  name: string
  kind: MedKind
  dose: string
  unit: DoseUnit
  timesPerDay: number
  /** Kür olarak verilen ilaçlarda önerilen süre sorusu gösterilir. */
  course?: boolean
}

export interface CatalogGroup {
  title: string
  items: CatalogItem[]
}

// Miktar bilinçli olarak boş: doz reçeteye göre kullanıcı tarafından girilir.
export const MED_CATALOG: CatalogGroup[] = [
  {
    title: 'Saç dökülmesi',
    items: [
      { name: 'Minoksidil', kind: 'ilac', dose: 'Köpük veya solüsyon', unit: 'ml', timesPerDay: 2 },
      { name: 'Oral minoksidil', kind: 'ilac', dose: 'Tablet', unit: 'mg', timesPerDay: 1 },
      { name: 'Finasterid', kind: 'ilac', dose: 'Tablet', unit: 'mg', timesPerDay: 1 },
      { name: 'Topikal finasterid', kind: 'ilac', dose: 'Sprey veya solüsyon', unit: 'ml', timesPerDay: 1 },
      { name: 'Dutasterid', kind: 'ilac', dose: 'Kapsül', unit: 'mg', timesPerDay: 1 },
      { name: 'Ketokonazol şampuan', kind: 'bakim', dose: 'Şampuan', unit: 'uygulama', timesPerDay: 1 },
    ],
  },
  {
    title: 'Ameliyat sonrası',
    items: [
      { name: 'Antibiyotik', kind: 'ilac', dose: 'Tablet', unit: 'mg', timesPerDay: 2, course: true },
      { name: 'Ağrı kesici', kind: 'ilac', dose: 'Tablet', unit: 'mg', timesPerDay: 2, course: true },
      { name: 'Kortikosteroid', kind: 'ilac', dose: 'Tablet', unit: 'mg', timesPerDay: 1, course: true },
      { name: 'Serum fizyolojik sprey', kind: 'bakim', dose: 'Sprey', unit: 'sprey', timesPerDay: 4, course: true },
      { name: 'Medikal şampuan', kind: 'bakim', dose: 'Şampuan', unit: 'uygulama', timesPerDay: 1, course: true },
      { name: 'Losyon veya krem', kind: 'bakim', dose: 'Losyon', unit: 'uygulama', timesPerDay: 2, course: true },
    ],
  },
  {
    title: 'Takviye',
    items: [
      { name: 'Biotin', kind: 'takviye', dose: 'Tablet', unit: 'mcg', timesPerDay: 1 },
      { name: 'Çinko', kind: 'takviye', dose: 'Tablet', unit: 'mg', timesPerDay: 1 },
      { name: 'Demir', kind: 'takviye', dose: 'Tablet', unit: 'mg', timesPerDay: 1 },
      { name: 'D vitamini', kind: 'takviye', dose: 'Damla veya kapsül', unit: 'IU', timesPerDay: 1 },
      { name: 'B12 vitamini', kind: 'takviye', dose: 'Tablet', unit: 'mcg', timesPerDay: 1 },
      { name: 'Omega 3', kind: 'takviye', dose: 'Kapsül', unit: 'mg', timesPerDay: 1 },
      { name: 'Kolajen', kind: 'takviye', dose: 'Toz veya tablet', unit: 'g', timesPerDay: 1 },
      { name: 'Saw palmetto', kind: 'takviye', dose: 'Kapsül', unit: 'mg', timesPerDay: 1 },
      { name: 'Multivitamin', kind: 'takviye', dose: 'Tablet', unit: 'tablet', timesPerDay: 1 },
    ],
  },
]

export const medFromCatalog = (item: CatalogItem, today: ISODate): Omit<Medication, 'id'> => ({
  name: item.name,
  kind: item.kind,
  dose: item.dose,
  unit: item.unit,
  schedule: [{ from: today, timesPerDay: item.timesPerDay, everyNDays: 1, amount: null }],
  slotTimes: DEFAULT_SLOT_TIMES[item.timesPerDay],
  endDate: null,
  stock: null,
  note: '',
})
