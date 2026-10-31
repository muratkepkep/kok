import { useState } from 'react'
import { MED_PRESETS } from '../components/MedForm'
import { Strands } from '../components/Strands'
import { SurgeryFields } from '../components/SurgeryFields'
import { buildDemoState } from '../domain/demo'
import type { Surgery } from '../domain/types'
import { actions, useToday } from '../store'

export function Onboarding() {
  const today = useToday()
  const [surgery, setSurgery] = useState<Surgery>({
    date: today,
    clinic: '',
    doctor: '',
    city: '',
    graftCount: null,
    technique: 'FUE',
    areas: [],
    note: '',
  })
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (name: string) =>
    setSelected((items) => (items.includes(name) ? items.filter((item) => item !== name) : [...items, name]))

  const start = (event: React.FormEvent) => {
    event.preventDefault()
    actions.saveSurgery({ ...surgery, clinic: surgery.clinic.trim() })
    for (const preset of MED_PRESETS) {
      if (!selected.includes(preset.name)) continue
      actions.newMed({
        name: preset.name,
        kind: preset.kind,
        dose: preset.dose,
        schedule: [{ from: today, timesPerDay: preset.timesPerDay, everyNDays: preset.everyNDays }],
      })
    }
  }

  return (
    <div className="onboarding">
      <header className="onboarding-head">
        <h1>Kök</h1>
        <p>Saç ekiminden sonraki 18 ayı ameliyat gününden itibaren hafta hafta takip et.</p>
      </header>
      <Strands currentWeek={1} />
      <form className="form onboarding-form" onSubmit={start}>
        <h2>Ameliyat bilgilerin</h2>
        <SurgeryFields value={surgery} onChange={setSurgery} />

        <fieldset className="field">
          <legend>Kullandığın ilaç ve takviyeler</legend>
          <div className="chips">
            {MED_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="chip"
                aria-pressed={selected.includes(preset.name)}
                onClick={() => toggle(preset.name)}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <small>Doktorunun önerdiklerini seç. Doz, sıklık ve başlangıç tarihini İlaçlar sayfasından değiştirebilirsin.</small>
        </fieldset>

        <div className="form-actions onboarding-actions">
          <button
            type="button"
            className="button-quiet"
            onClick={() => actions.replaceAll(buildDemoState(today))}
          >
            Örnek verilerle incele
          </button>
          <button type="submit" className="button">
            Takibi başlat
          </button>
        </div>
        <p className="form-note">Verilerin bu cihazda saklanır. Uygulama hiçbir sunucuya veri göndermez.</p>
      </form>
    </div>
  )
}
