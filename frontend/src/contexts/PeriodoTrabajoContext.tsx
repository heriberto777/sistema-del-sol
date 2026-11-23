import { createContext, ReactNode, useMemo, useState } from 'react';

interface PeriodoTrabajoContextValue {
  /** Fecha ISO (YYYY-MM-DD) que los formularios con fecha manual precargan por defecto. */
  fecha: string;
  setFecha: (fecha: string) => void;
  volverAHoy: () => void;
  esHoy: boolean;
}

export const PeriodoTrabajoContext = createContext<PeriodoTrabajoContextValue | undefined>(undefined);

const STORAGE_KEY = 'sol_periodo_trabajo';

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * docs/PLAN.md — "Período de trabajo + advertencia blanda". Mismo patrón
 * que `SucursalActivaContext` (localStorage, por navegador/usuario — NO
 * tenant-wide): si fuera una sola fecha para todo el tenant, alguien
 * haciendo catch-up de un mes viejo le rompería el default a cualquier
 * otro que esté cargando algo de hoy mismo en simultáneo. Puramente UX —
 * no reemplaza `validarPeriodoAbierto` (la única validación dura real),
 * solo precarga el campo fecha de los formularios que lo tienen y avisa
 * (sin bloquear) si el usuario elige algo de un mes distinto.
 */
export function PeriodoTrabajoProvider({ children }: { children: ReactNode }) {
  const [fecha, setFechaState] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || hoyISO());

  function setFecha(nuevaFecha: string) {
    setFechaState(nuevaFecha);
    localStorage.setItem(STORAGE_KEY, nuevaFecha);
  }

  function volverAHoy() {
    setFechaState(hoyISO());
    localStorage.removeItem(STORAGE_KEY);
  }

  const value = useMemo(() => ({ fecha, setFecha, volverAHoy, esHoy: fecha === hoyISO() }), [fecha]);

  return <PeriodoTrabajoContext.Provider value={value}>{children}</PeriodoTrabajoContext.Provider>;
}
