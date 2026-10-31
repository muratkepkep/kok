const integer = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })
const percent = new Intl.NumberFormat('tr-TR', { style: 'percent', maximumFractionDigits: 0 })

export const fmtInt = (value: number) => integer.format(value)
export const fmtDecimal = (value: number) => oneDecimal.format(value)

/** 0–1 arası oran, Türkçe yazımla: %92. */
export const fmtRatio = (ratio: number | null) => (ratio === null ? '–' : percent.format(ratio))

/** 0–100 arası puan: %35. */
export const fmtScore = (score: number | null) => (score === null ? '–' : percent.format(score / 100))

export const fmtSigned = (value: number) => {
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return '0'
  return `${rounded > 0 ? '+' : '−'}${oneDecimal.format(Math.abs(rounded))}`
}
