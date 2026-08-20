import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';

interface RegistroAsistencia {
  horaEntrada: string | null;
  horaSalida: string | null;
}

interface MiEstadoHoy {
  tieneEmpleado: boolean;
  registro: RegistroAsistencia | null;
}

/**
 * Autoservicio de marcaje — deliberadamente separado del login/logout del
 * sistema (el usuario pidió explícitamente que loguearse NO cuente como
 * registro de entrada/salida para RRHH). Se oculta por completo si el
 * usuario no tiene un Empleado vinculado (Empleado.userId) — no todo
 * usuario de sistema está en la planilla.
 */
export function MarcarAsistenciaWidget() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['rrhh-mi-estado-hoy'],
    queryFn: async () => (await apiClient.get<MiEstadoHoy>('/nomina/asistencia/mi-estado-hoy')).data,
    refetchInterval: 60_000,
  });

  const marcar = useMutation({
    mutationFn: async (accion: 'marcar-entrada' | 'marcar-salida') => apiClient.post(`/nomina/asistencia/${accion}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rrhh-mi-estado-hoy'] }),
  });

  if (!data?.tieneEmpleado) return null;

  const { registro } = data;

  if (registro?.horaEntrada && registro?.horaSalida) {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Hoy: entrada {registro.horaEntrada} · salida {registro.horaSalida}
      </span>
    );
  }

  if (registro?.horaEntrada) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">Entrada {registro.horaEntrada}</span>
        <Button variante="secundario" onClick={() => marcar.mutate('marcar-salida')} disabled={marcar.isPending}>
          {marcar.isPending ? 'Marcando…' : 'Marcar salida'}
        </Button>
      </div>
    );
  }

  return (
    <Button variante="secundario" onClick={() => marcar.mutate('marcar-entrada')} disabled={marcar.isPending}>
      {marcar.isPending ? 'Marcando…' : 'Marcar entrada'}
    </Button>
  );
}
