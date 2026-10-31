import { Check, Pencil } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Reveal, Stepper, SubHead } from '../components/fx'
import { fmtFull } from '../domain/dates'
import { ruleStatuses } from '../domain/rules'
import { actions, useAppState, useToday } from '../store'

export function Rules() {
  const state = useAppState()
  const today = useToday()
  const [editing, setEditing] = useState<string | null>(null)
  const rules = ruleStatuses(state.surgery!.date, state.ruleDays, today)

  return (
    <div className="page stack">
      <SubHead title="Kısıtlar" />
      <p className="muted">
        Bunlar genel sürelerdir. Kliniğinin söylediği süre önceliklidir, kaleme dokunup kendi süreni girebilirsin.
      </p>

      {rules.map((rule, index) => (
        <Reveal key={rule.id} i={index}>
          <article className="card rule" data-free={rule.free || undefined}>
            <div className="rule-head">
              <div>
                <h2>{rule.free ? rule.done : rule.title}</h2>
                <small>{rule.free ? `${fmtFull(rule.until)} itibarıyla serbest` : `${fmtFull(rule.until)} tarihine kadar`}</small>
              </div>
              <span className="rule-count">
                {rule.free ? <Check size={22} strokeWidth={3} aria-hidden /> : rule.remaining}
                {!rule.free && <small>gün</small>}
              </span>
            </div>
            <div className="rule-bar" aria-hidden>
              <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: rule.progress }} transition={{ type: 'spring', stiffness: 70, damping: 16, delay: index * 0.04 }} />
            </div>
            <p className="muted">{rule.body}</p>
            <div className="rule-foot">
              {editing === rule.id ? (
                <>
                  <Stepper
                    value={rule.days}
                    step={1}
                    label={`${rule.title} süresi`}
                    format={(value) => `${value} gün`}
                    onChange={(value) => actions.setRuleDays(rule.id, value)}
                  />
                  {rule.customized && (
                    <button type="button" className="link" onClick={() => actions.setRuleDays(rule.id, null)}>
                      Genel süreye dön
                    </button>
                  )}
                </>
              ) : (
                <button type="button" className="mini-button" onClick={() => setEditing(rule.id)}>
                  <Pencil size={14} aria-hidden /> {rule.days} gün{rule.customized ? ', klinik süresi' : ''}
                </button>
              )}
            </div>
          </article>
        </Reveal>
      ))}
    </div>
  )
}
