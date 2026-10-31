import { Award, Lock } from 'lucide-react'
import { CountUp, Reveal, Ring, SubHead } from '../components/fx'
import { bestStreak, streak } from '../domain/adherence'
import { badgesOf } from '../domain/badges'
import { useAppState, useToday } from '../store'

export function Badges() {
  const state = useAppState()
  const today = useToday()
  const badges = badgesOf(state, today)
  const earned = badges.filter((badge) => badge.done).length

  return (
    <div className="page stack">
      <SubHead title="Başarılar" />

      <Reveal>
        <section className="card card-glow duo-rings">
          <div>
            <Ring value={earned / badges.length} size={112} thickness={10} from="#b6ff3c" to="#2ef2ff">
              <strong className="ring-value ring-small">
                {earned}/{badges.length}
              </strong>
            </Ring>
            <small>Rozet</small>
          </div>
          <dl className="stat-column">
            <div>
              <dt>Güncel seri</dt>
              <dd>
                <CountUp value={streak(state.meds, state.doses, today)} /> gün
              </dd>
            </div>
            <div>
              <dt>En uzun seri</dt>
              <dd>
                <CountUp value={bestStreak(state.meds, state.doses, today)} /> gün
              </dd>
            </div>
          </dl>
        </section>
      </Reveal>

      <div className="badge-grid">
        {badges.map((badge, index) => (
          <Reveal key={badge.id} i={index}>
            <article className="badge" data-done={badge.done || undefined}>
              <span className="badge-mark">{badge.done ? <Award size={24} aria-hidden /> : <Lock size={18} aria-hidden />}</span>
              <strong>{badge.title}</strong>
              <small>{badge.body}</small>
              <div className="rule-bar" aria-hidden>
                <i style={{ transform: `scaleX(${badge.progress})` }} />
              </div>
              <small className="badge-value">{badge.value}</small>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
