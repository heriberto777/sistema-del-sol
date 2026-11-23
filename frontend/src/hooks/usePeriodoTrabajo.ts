import { useContext } from 'react';
import { PeriodoTrabajoContext } from '../contexts/PeriodoTrabajoContext';

export function usePeriodoTrabajo() {
  const context = useContext(PeriodoTrabajoContext);
  if (!context) {
    throw new Error('usePeriodoTrabajo debe usarse dentro de un <PeriodoTrabajoProvider>');
  }
  return context;
}
