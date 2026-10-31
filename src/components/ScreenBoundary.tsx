import { Component, type ReactNode } from 'react'

/** Tek bir sayfadaki hata tüm uygulamayı kapatmasın, kayıtlara ulaşılabilsin. */
export class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="section" role="alert">
        <h1>Bu sayfa açılamadı</h1>
        <p className="lead">
          Kayıtların bu cihazda duruyor. Başka bir sayfaya geçebilir veya uygulamayı yeniden yükleyebilirsin.
        </p>
        <button type="button" className="button" onClick={() => window.location.reload()}>
          Yeniden yükle
        </button>
      </section>
    )
  }
}
