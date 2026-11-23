import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

interface PeriodoVigente {
  id: string;
  estado: 'ABIERTO' | 'CERRADO';
}

/**
 * ¿Hay un PeriodoContable que cubra la fecha de hoy? `GET
 * /contabilidad/cierre-periodo/vigente` no exige `contabilidad.ver` a
 * propósito (lo consultan Facturación/Compras/Nómina/Gastos Menores,
 * cuyos usuarios no necesariamente tienen ese permiso) — solo devuelve
 * si existe o no, nunca montos.
 *
 * Incidente real (2026-11-18): el cron que crea el período del mes
 * siguiente (`PeriodosContablesCronService`, corre 5 días antes de fin
 * de mes) no reintenta ejecuciones perdidas — si el backend estuvo caído
 * esa ventana, nadie se entera hasta que Facturación/Compras/Nómina
 * empiezan a rechazar con un 400 genérico el día 1. Este hook alimenta
 * el aviso que avisa ANTES de llegar a ese error.
 */
export function usePeriodoVigente() {
  const { data, isLoading } = useQuery({
    queryKey: ['contabilidad-periodo-vigente'],
    queryFn: async () => (await apiClient.get<PeriodoVigente | null>('/contabilidad/cierre-periodo/vigente')).data,
    staleTime: 5 * 60_000,
  });

  return { hayPeriodoVigente: !isLoading && !!data, cargando: isLoading };
}
