import { useContext } from 'react';
import { SucursalActivaContext } from '../contexts/SucursalActivaContext';

export function useSucursalActiva() {
  const context = useContext(SucursalActivaContext);
  if (!context) {
    throw new Error('useSucursalActiva debe usarse dentro de un <SucursalActivaProvider>');
  }
  return context;
}
