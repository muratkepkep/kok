import { Reveal, SubHead } from '../components/fx'

const ITEMS = [
  { title: 'Verilerin cihazında', body: 'Doz, ölçüm, belirti ve fotoğraf kayıtların yalnızca bu iPhone\'da saklanır. Kök\'ün sunucusu yoktur.' },
  { title: 'Takip ve analitik yok', body: 'Uygulama reklam, analitik veya takip aracı içermez. Kayıtların üçüncü taraflara gönderilmez.' },
  { title: 'Paylaşım senin kararın', body: 'Yedek ve doktor raporu yalnızca sen paylaştığında dışarı çıkar.' },
  { title: 'Kilit ekranı', body: 'Hatırlatmalarda ilaç adı görünmesin istersen Hatırlatmalar sayfasından gizleyebilirsin.' },
  { title: 'Silme hakkın', body: 'Operasyon sayfasındaki Tüm verileri sil seçeneği kayıtlarını ve fotoğraflarını bu cihazdan kaldırır. Uygulamayı silmek de verileri siler.' },
  { title: 'Tıbbi uyarı', body: 'Kök bir takip aracıdır; teşhis koymaz, tedavi veya doz önermez. Bilgiler geneldir, doktorunun talimatı önceliklidir.' },
]

export function Privacy() {
  return (
    <div className="page stack">
      <SubHead title="Gizlilik" />
      {ITEMS.map((item, index) => (
        <Reveal key={item.title} i={index}>
          <section className="card">
            <h2>{item.title}</h2>
            <p className="muted">{item.body}</p>
          </section>
        </Reveal>
      ))}
    </div>
  )
}
