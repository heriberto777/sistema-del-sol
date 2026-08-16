import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(valor: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(valor);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(valor), delayMs);
    return () => clearTimeout(timeout);
  }, [valor, delayMs]);

  return debounced;
}
