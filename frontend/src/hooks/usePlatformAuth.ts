import { useContext } from 'react';
import { PlatformAuthContext } from '../contexts/PlatformAuthContext';

export function usePlatformAuth() {
  const context = useContext(PlatformAuthContext);
  if (!context) {
    throw new Error('usePlatformAuth debe usarse dentro de un <PlatformAuthProvider>');
  }
  return context;
}
