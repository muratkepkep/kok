import { useLayoutEffect, useRef, useState } from 'react'

/** Grafiklerin metni ölçeklemeden gerçek pikselde çizilmesi için kapsayıcı genişliği. */
export const useWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    // Gözlemci ilk çizimden sonra çalışır; ölçüm burada yapılırsa grafik boş görünmez.
    setWidth(Math.round(element.getBoundingClientRect().width))
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}
