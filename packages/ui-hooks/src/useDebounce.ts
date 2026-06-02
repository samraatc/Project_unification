import { useEffect, useState } from 'react';

/** Debounce a fast-changing value. Defaults to 250ms, suitable for search-as-you-type. */
export function useDebounce<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
