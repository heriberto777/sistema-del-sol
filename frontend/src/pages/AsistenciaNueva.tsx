import { FormEvent, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { PaginaResultado } from '../types/pagina-resultado';
import { useHayCambios } from '../hooks/useHayCambios';

interface Empleado {
  id: string;
  nombre: string;
  cedula: string;
}

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal "Registrar asistencia manualmente" de AsistenciaTable.tsx. */
export function AsistenciaNueva() {
  const navigate = useNavigate();
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [fecha, setFecha] = useState('');
  const [horaEntrada, setHoraEntrada] = useState('');
  const [horaSalida, setHoraSalida] = useState('');
  const [error, setError] = useState<string | null>(null);

  const registrar = useMutation({
    mutationFn: async () =>
      apiClient.post('/nomina/asistencia', {
        empleadoId: empleado!.id,
        fecha,
        horaEntrada: horaEntrada || undefined,
        horaSalida: horaSalida || undefined,
      }),
    onSuccess: () => {
      confirmarGuardado();
      navigate('/asistencia');
    },
    onError: (e: unknown) => {
      const mensaje = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(mensaje ?? 'No se pudo registrar la asistencia.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!empleado) {
      setError('Seleccioná un empleado.');
      return;
    }
    registrar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ empleadoId: empleado?.id, fecha, horaEntrada, horaSalida });

  return (
    <PaginaDocumento
      titulo="Registrar asistencia manualmente"
      rutaVolver="/asistencia"
      etiquetaVolver="Volver a Asistencia"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Empleado</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{empleado?.nombre ?? 'Sin seleccionar'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nueva-asistencia" disabled={registrar.isPending} className="w-full">
            {registrar.isPending ? 'Guardando…' : 'Guardar registro'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/asistencia')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-asistencia" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Información del registro">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Empleado</label>
            <ComboboxBusqueda<Empleado>
              valor={empleado}
              onSeleccionar={setEmpleado}
              buscar={async (texto) =>
                (await apiClient.get<PaginaResultado<Empleado>>('/nomina/empleados', { params: { busqueda: texto, tamanoPagina: 20 } })).data
                  .datos
              }
              obtenerId={(e) => e.id}
              obtenerEtiqueta={(e) => `${e.nombre} — ${e.cedula}`}
              placeholder="Buscar empleado por nombre o cédula…"
              icono={<User size={15} />}
            />
          </div>
          <FormField id="asistencia-fecha" label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          <FormField
            id="asistencia-entrada"
            label="Hora de entrada (opcional)"
            type="time"
            value={horaEntrada}
            onChange={(e) => setHoraEntrada(e.target.value)}
          />
          <FormField
            id="asistencia-salida"
            label="Hora de salida (opcional)"
            type="time"
            value={horaSalida}
            onChange={(e) => setHoraSalida(e.target.value)}
          />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
