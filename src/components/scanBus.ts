export const pulses = new Set<() => void>()

/** Hologramda tarama dalgası başlatır; 3B kod yüklenmeden de çağrılabilir. */
export const scanPulse = () => pulses.forEach((pulse) => pulse())
