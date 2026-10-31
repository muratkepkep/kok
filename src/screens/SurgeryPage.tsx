import { useRef, useState } from 'react'
import { SubHead } from '../components/fx'
import { SurgeryFields } from '../components/SurgeryFields'
import { buildBackup, parseBackup } from '../domain/backup'
import { EMPTY_STATE } from '../domain/types'
import { clearPhotos, exportPhotos, replacePhotos, saveBackupFile } from '../photos'
import { actions, getState, useAppState, useToday } from '../store'

function Backup() {
  const today = useToday()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const download = async () => {
    setMessage('')
    try {
      const backup = buildBackup(getState(), await exportPhotos())
      const saved = await saveBackupFile(`kok-yedek-${today}.json`, JSON.stringify(backup))
      if (saved) setMessage('Yedek alındı.')
    } catch {
      setMessage('Yedek oluşturulamadı. Cihazda yeterli alan olduğundan emin ol.')
    }
  }

  const restore = async (file: File) => {
    try {
      const backup = parseBackup(await file.text())
      if (!window.confirm('Yedek, bu cihazdaki tüm kayıtların yerini alacak. Devam edilsin mi?')) return
      await replacePhotos(backup.photos)
      actions.replaceAll(backup.state)
      setMessage('Yedek geri yüklendi.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Yedek geri yüklenemedi.')
    }
  }

  return (
    <section className="card">
      <h2>Yedek</h2>
      <p className="section-note">
        Kayıtların yalnızca bu cihazda durur ve uygulama silinirse kaybolur. Arada bir yedek al, dosyayı Dosyalar
        uygulamasına veya iCloud Drive'a kaydet. Yedek fotoğrafları da içerir.
      </p>
      <div className="med-actions">
        <button type="button" className="button-quiet" onClick={() => void download()}>
          Yedek al
        </button>
        <button type="button" className="button-quiet" onClick={() => input.current?.click()}>
          Yedekten geri yükle
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void restore(file)
            event.target.value = ''
          }}
        />
        <button
          type="button"
          className="button-quiet button-danger"
          onClick={() => {
            if (window.confirm('Tüm kayıtlar ve fotoğraflar silinsin mi? Bu işlem geri alınamaz.')) {
              void clearPhotos()
              actions.replaceAll(EMPTY_STATE)
              window.location.hash = 'bugun'
            }
          }}
        >
          Tüm verileri sil
        </button>
      </div>
      {message && <p className="section-note" role="status">{message}</p>}
    </section>
  )
}

export function SurgeryPage() {
  const state = useAppState()
  const [surgery, setSurgery] = useState(state.surgery!)
  const [saved, setSaved] = useState(false)

  return (
    <div className="page stack">
      <SubHead title="Operasyon" />
      <div className="split">
        <form
          className="card form-card"
          onSubmit={(event) => {
            event.preventDefault()
            actions.saveSurgery(surgery)
            setSaved(true)
          }}
        >
          <SurgeryFields
            value={surgery}
            onChange={(next) => {
              setSurgery(next)
              setSaved(false)
            }}
          />
          <div className="form-actions">
            {saved && <span role="status">Kaydedildi</span>}
            <button type="submit" className="button">
              Bilgileri kaydet
            </button>
          </div>
        </form>
        <section className="card">
          <h2>Klinik notları</h2>
          <p className="section-note">Doktorunun verdiği talimatlar, sana özel süreler ve sorular burada dursun.</p>
          <label className="field">
            <span className="visually-hidden">Klinik notları</span>
            <textarea
              rows={4}
              value={state.clinicNotes}
              onChange={(event) => actions.saveClinicNotes(event.target.value)}
            />
          </label>
        </section>
        <Backup />
      </div>
    </div>
  )
}
