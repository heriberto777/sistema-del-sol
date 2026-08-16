import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

export type Tema = 'claro' | 'oscuro';

interface ThemeContextValue {
  tema: Tema;
  toggleTema: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'sol_tema';

function temaInicial(): Tema {
  const guardado = localStorage.getItem(STORAGE_KEY);
  if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro');
    localStorage.setItem(STORAGE_KEY, tema);
  }, [tema]);

  const toggleTema = useCallback(() => {
    setTema((actual) => (actual === 'claro' ? 'oscuro' : 'claro'));
  }, []);

  const value = useMemo(() => ({ tema, toggleTema }), [tema, toggleTema]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
