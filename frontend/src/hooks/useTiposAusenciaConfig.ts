import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export type TipoAusencia = 'VACACIONES' | 'ENFERMEDAD' | 'PERMISO' | 'INJUSTIFICADA' | 'MATERNIDAD_PATERNIDAD' | 'OTRO';

export interface TipoAusenciaConfig {
  id: string;
  tipo: TipoAusencia;
  maximoDiasPorAnio: number | null;
  conGoceDeSueldoPorDefecto: boolean;
  requiereAprobacion: boolean;
  activo: boolean;
}

/** Reglas por tipo de ausencia configurables por tenant (plan de integración Cuadre, ítem G-2) — 6 filas fijas, sembradas al provisionar. */
export function useTiposAusenciaConfig() {
  return useQuery({
    queryKey: ['nomina-tipos-ausencia-config'],
    queryFn: async () => (await apiClient.get<TipoAusenciaConfig[]>('/nomina/tipos-ausencia')).data,
  });
}
