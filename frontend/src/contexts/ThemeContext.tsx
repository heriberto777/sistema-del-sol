import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

export type Tema = 'claro' | 'oscuro';
export type TamanoFuente = 'normal' | 'grande' | 'muy-grande';

interface ThemeContextValue {
  tema: Tema;
  toggleTema: () => void;
  tamanoFuente: TamanoFuente;
  setTamanoFuente: (tamano: TamanoFuente) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'sol_tema';
const STORAGE_KEY_FUENTE = 'sol_tamano_fuente';

// Porcentaje del font-size del <html> — la escala de Tailwind en este
// proyecto es 100% rem (sin overrides, ver tailwind.config.js), así que
// esto reescala proporcionalmente todo el texto de la app sin tocar
// ningún componente.
const ESCALA_FUENTE: Record<TamanoFuente, string> = {
  normal: '100%',
  grande: '112.5%',
  'muy-grande': '125%',
};

function temaInicial(): Tema {
  const guardado = localStorage.getItem(STORAGE_KEY);
  if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

function tamanoFuenteInicial(): TamanoFuente {
  const guardado = localStorage.getItem(STORAGE_KEY_FUENTE);
  if (guardado === 'normal' || guardado === 'grande' || guardado === 'muy-grande') return guardado;
  return 'normal';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);
  const [tamanoFuente, setTamanoFuente] = useState<TamanoFuente>(tamanoFuenteInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro');
    localStorage.setItem(STORAGE_KEY, tema);
  }, [tema]);

  useEffect(() => {
    document.documentElement.style.fontSize = ESCALA_FUENTE[tamanoFuente];
    localStorage.setItem(STORAGE_KEY_FUENTE, tamanoFuente);
  }, [tamanoFuente]);

  const toggleTema = useCallback(() => {
    setTema((actual) => (actual === 'claro' ? 'oscuro' : 'claro'));
  }, []);

  const value = useMemo(
    () => ({ tema, toggleTema, tamanoFuente, setTamanoFuente }),
    [tema, toggleTema, tamanoFuente],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
