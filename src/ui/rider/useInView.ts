import { useEffect, useState, type RefObject } from 'react';

/**
 * ¿Está el elemento en pantalla? Para no repintar cada medio segundo un dial que nadie ve
 * (en la web, al bajar a los resultados, el dial queda arriba fuera de la vista).
 */
export function useInView(ref: RefObject<Element | null>, margin = '0px'): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return visible;
}
