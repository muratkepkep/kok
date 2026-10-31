import { ChevronDown, ShieldAlert } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Reveal, SubHead } from '../components/fx'
import { GUIDE } from '../domain/guide'
import { tapLight } from '../haptics'

export function Guide() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="page stack">
      <SubHead title="Normal mi?" />
      <p className="muted">Genel bilgilendirmedir, tıbbi tavsiye değildir. Kliniğinin talimatı her zaman önceliklidir.</p>

      {GUIDE.map((item, index) => {
        const expanded = open === index
        return (
          <Reveal key={item.question} i={index}>
            <article className="card guide-item">
              <button
                type="button"
                className="guide-question"
                aria-expanded={expanded}
                onClick={() => {
                  tapLight()
                  setOpen(expanded ? null : index)
                }}
              >
                <strong>{item.question}</strong>
                <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
                  <ChevronDown size={18} aria-hidden />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    className="guide-answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  >
                    <p>{item.answer}</p>
                    {item.warn && (
                      <p className="guide-warn">
                        <ShieldAlert size={16} aria-hidden /> {item.warn}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </article>
          </Reveal>
        )
      })}
    </div>
  )
}
