import { useCallback, useEffect, useState } from 'react';

/**
 * Favoritos del catálogo público (Fase 4) — sin cuenta de visitante (a
 * diferencia de Tienda Online, Inmobiliaria no tiene auth de cliente
 * propia), así que se guardan en `localStorage`, por navegador, con clave
 * propia por tenant (`subdominio`) para no mezclar favoritos de dos
 * catálogos distintos si el visitante los prueba ambos.
 */
export function useFavoritosPropiedades(subdominio: string) {
  const clave = `inmobiliaria-favoritos-${subdominio}`;
  const [favoritos, setFavoritos] = useState<string[]>(() => {
    try {
      const guardado = localStorage.getItem(clave);
      return guardado ? (JSON.parse(guardado) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(clave, JSON.stringify(favoritos));
    } catch {
      // localStorage puede fallar (privado, cuota, etc.) — el favorito
      // simplemente no persiste entre visitas, no rompe la página.
    }
  }, [clave, favoritos]);

  const esFavorito = useCallback((id: string) => favoritos.includes(id), [favoritos]);

  const alternar = useCallback((id: string) => {
    setFavoritos((actual) => (actual.includes(id) ? actual.filter((f) => f !== id) : [...actual, id]));
  }, []);

  return { favoritos, esFavorito, alternar };
}
