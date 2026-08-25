import { FormEvent, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface Empleado {
  id: string;
  nombre: string;
  cedula: string;
}

type EstadoAsistencia = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

const TONOS_ESTADO_ASISTENCIA: Record<EstadoAsistencia, 'neutro' | 'exito' | 'peligro'> = {
  PENDIENTE: 'neutro',
  APROBADO: 'exito',
  RECHAZADO: 'peligro',
};

interface RegistroAsistencia {
  id: string;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  tardanza: boolean;
  salidaAnticipada: boolean;
  horasExtra: string | null;
  estado: EstadoAsistencia;
  empleado: { id: string; nombre: string; cedula: string };
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-DO', { timeZone: 'UTC' });
}

export function AsistenciaTable() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [empleadoFiltro, setEmpleadoFiltro] = useState<Empleado | null>(null);
  const [pagina, setPagina] = useState(1);
  const [modalManual, setModalManual] = useState(false);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['rrhh-asistencia', empleadoFiltro?.id, pagina],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<RegistroAsistencia>>('/nomina/asistencia', {
          params: { empleadoId: empleadoFiltro?.id, pagina },
        })
      ).data,
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'APROBADO' | 'RECHAZADO' }) =>
      apiClient.patch(`/nomina/asistencia/${id}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rrhh-asistencia'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="max-w-sm flex-1">
          <ComboboxBusqueda<Empleado>
            valor={empleadoFiltro}
            onSeleccionar={(e) => {
              setEmpleadoFiltro(e);
              setPagina(1);
            }}
            buscar={async (texto) =>
              (await apiClient.get<PaginaResultado<Empleado>>('/nomina/empleados', { params: { busqueda: texto, tamanoPagina: 20 } })).data
                .datos
            }
            obtenerId={(e) => e.id}
            obtenerEtiqueta={(e) => `${e.nombre} — ${e.cedula}`}
            placeholder="Filtrar por empleado…"
            icono={<User size={15} />}
          />
        </div>
        {tienePermiso('rrhh.editar') && <Button onClick={() => setModalManual(true)}>Registrar manualmente</Button>}
      </div>

      <Card sinPadding titulo="Asistencia" descripcion={data ? `${data.total} registro(s)` : undefined}>
        {isLoading && <p className="p-5 text-sm text-slate-500">Cargando asistencia…</p>}
        {errorCarga && <p className="p-5 text-sm text-red-600">No se pudo cargar la asistencia.</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Empleado</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Entrada</th>
                  <th className="px-5 py-3 font-medium">Salida</th>
                  <th className="px-5 py-3 font-medium">Novedades</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.datos.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{r.empleado.nombre}</td>
                    <td className="px-5 py-3">{formatearFecha(r.fecha)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{r.horaEntrada ?? '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs">{r.horaSalida ?? '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.tardanza && <Badge tono="advertencia">Tardanza</Badge>}
                        {r.salidaAnticipada && <Badge tono="advertencia">Salida anticipada</Badge>}
                        {!!r.horasExtra && Number(r.horasExtra) > 0 && <Badge tono="exito">+{r.horasExtra}h extra</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tono={TONOS_ESTADO_ASISTENCIA[r.estado]}>{r.estado}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      {r.estado === 'PENDIENTE' && tienePermiso('rrhh.aprobar') && (
                        <div className="flex gap-2">
                          <Button onClick={() => cambiarEstado.mutate({ id: r.id, estado: 'APROBADO' })} disabled={cambiarEstado.isPending}>
                            Aprobar
                          </Button>
                          <Button
                            variante="peligro"
                            onClick={() => cambiarEstado.mutate({ id: r.id, estado: 'RECHAZADO' })}
                            disabled={cambiarEstado.isPending}
                          >
                            Rechazar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {data.datos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-slate-500">
                      Sin registros de asistencia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>

      {modalManual && (
        <ModalRegistrarManual
          onClose={() => setModalManual(false)}
          onCreado={() => queryClient.invalidateQueries({ queryKey: ['rrhh-asistencia'] })}
        />
      )}
    </div>
  );
}

function ModalRegistrarManual({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
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
      onCreado();
      onClose();
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

  return (
    <Modal titulo="Registrar asistencia manualmente" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
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
        <FormField id="asistencia-entrada" label="Hora de entrada (opcional)" type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} />
        <FormField id="asistencia-salida" label="Hora de salida (opcional)" type="time" value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={registrar.isPending} className="w-full">
          {registrar.isPending ? 'Guardando…' : 'Guardar registro'}
        </Button>
      </form>
    </Modal>
  );
}
