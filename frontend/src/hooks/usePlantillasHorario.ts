import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface PlantillaHorario {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  predeterminada: boolean;
  activa: boolean;
}

/** Catálogo de plantillas de horario activas del tenant (plan de integración Cuadre, ítem G-1) — referencia viva, ver Empleado.plantillaHorarioId. */
export function usePlantillasHorario() {
  return useQuery({
    queryKey: ['plantillas-horario-activas'],
    queryFn: async () => (await apiClient.get<PlantillaHorario[]>('/nomina/plantillas-horario', { params: { activa: true } })).data,
  });
}
