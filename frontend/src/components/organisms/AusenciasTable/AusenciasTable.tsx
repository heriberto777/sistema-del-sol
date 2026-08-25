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
import { Select } from '../../atoms/Select/Select';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { useTiposAusenciaConfig } from '../../../hooks/useTiposAusenciaConfig';

interface Empleado {
  id: string;
  nombre: string;
  cedula: string;
}

type TipoAusencia = 'VACACIONES' | 'ENFERMEDAD' | 'PERMISO' | 'INJUSTIFICADA' | 'MATERNIDAD_PATERNIDAD' | 'OTRO';
type EstadoAusencia = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA';

interface Ausencia {
  id: string;
  tipo: TipoAusencia;
  fechaDesde: string;
  fechaHasta: string;
  conGoceDeSueldo: boolean;
  motivo: string | null;
  estado: EstadoAusencia;
  empleado: { id: string; nombre: string; cedula: string };
}

const ETIQUETAS_TIPO: Record<TipoAusencia, string> = {
  VACACIONES: 'Vacaciones',
  ENFERMEDAD: 'Enfermedad',
  PERMISO: 'Permiso',
  INJUSTIFICADA: 'Injustificada',
  MATERNIDAD_PATERNIDAD: 'Maternidad/Paternidad',
  OTRO: 'Otro',
};

const TONOS_ESTADO: Record<EstadoAusencia, 'neutro' | 'exito' | 'peligro'> = {
  SOLICITADA: 'neutro',
  APROBADA: 'exito',
  RECHAZADA: 'peligro',
};

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-DO', { timeZone: 'UTC' });
}

export function AusenciasTable() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [modalNueva, setModalNueva] = useState(false);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['rrhh-ausencias', pagina],
    queryFn: async () => (await apiClient.get<PaginaResultado<Ausencia>>('/nomina/ausencias', { params: { pagina } })).data,
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'APROBADA' | 'RECHAZADA' }) =>
      apiClient.patch(`/nomina/ausencias/${id}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rrhh-ausencias'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {tienePermiso('rrhh.editar') && <Button onClick={() => setModalNueva(true)}>Solicitar ausencia</Button>}
      </div>

      <Card sinPadding titulo="Ausencias" descripcion={data ? `${data.total} solicitud(es)` : undefined}>
        {isLoading && <p className="p-5 text-sm text-slate-500">Cargando ausencias…</p>}
        {errorCarga && <p className="p-5 text-sm text-red-600">No se pudieron cargar las ausencias.</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Empleado</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Desde</th>
                  <th className="px-5 py-3 font-medium">Hasta</th>
                  <th className="px-5 py-3 font-medium">Goce de sueldo</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.datos.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{a.empleado.nombre}</td>
                    <td className="px-5 py-3">{ETIQUETAS_TIPO[a.tipo]}</td>
                    <td className="px-5 py-3">{formatearFecha(a.fechaDesde)}</td>
                    <td className="px-5 py-3">{formatearFecha(a.fechaHasta)}</td>
                    <td className="px-5 py-3">{a.conGoceDeSueldo ? 'Sí' : 'No'}</td>
                    <td className="px-5 py-3">
                      <Badge tono={TONOS_ESTADO[a.estado]}>{a.estado}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      {a.estado === 'SOLICITADA' && tienePermiso('rrhh.aprobar') && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => cambiarEstado.mutate({ id: a.id, estado: 'APROBADA' })}
                            disabled={cambiarEstado.isPending}
                          >
                            Aprobar
                          </Button>
                          <Button
                            variante="peligro"
                            onClick={() => cambiarEstado.mutate({ id: a.id, estado: 'RECHAZADA' })}
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
                      Sin solicitudes de ausencia.
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

      {modalNueva && (
        <ModalSolicitarAusencia
          onClose={() => setModalNueva(false)}
          onCreada={() => queryClient.invalidateQueries({ queryKey: ['rrhh-ausencias'] })}
        />
      )}
    </div>
  );
}

const CON_GOCE_POR_DEFECTO: Record<TipoAusencia, boolean> = {
  VACACIONES: true,
  ENFERMEDAD: true,
  PERMISO: true,
  MATERNIDAD_PATERNIDAD: true,
  INJUSTIFICADA: false,
  OTRO: true,
};

interface BalanceVacaciones {
  aniosCompletos: number;
  diasAcumulados: number;
  diasDisponibles: number;
  diasPagoPorAntiguedad: number;
}

function ModalSolicitarAusencia({ onClose, onCreada }: { onClose: () => void; onCreada: () => void }) {
  const { data: tiposConfig } = useTiposAusenciaConfig();
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [tipo, setTipo] = useState<TipoAusencia>('VACACIONES');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [conGoceDeSueldo, setConGoceDeSueldo] = useState(true);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tiposActivos = (Object.keys(ETIQUETAS_TIPO) as TipoAusencia[]).filter(
    (t) => (tiposConfig?.find((c) => c.tipo === t)?.activo ?? true),
  );
  const configTipoActual = tiposConfig?.find((c) => c.tipo === tipo);

  const { data: balance } = useQuery({
    queryKey: ['rrhh-balance-vacaciones', empleado?.id],
    queryFn: async () => (await apiClient.get<BalanceVacaciones>(`/nomina/empleados/${empleado!.id}/balance-vacaciones`)).data,
    enabled: !!empleado && tipo === 'VACACIONES',
  });

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/nomina/ausencias', {
        empleadoId: empleado!.id,
        tipo,
        fechaDesde,
        fechaHasta,
        conGoceDeSueldo,
        motivo: motivo || undefined,
      }),
    onSuccess: () => {
      onCreada();
      onClose();
    },
    onError: (e: unknown) => {
      const mensaje = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(mensaje ?? 'No se pudo registrar la solicitud.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!empleado) {
      setError('Seleccioná un empleado.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo="Solicitar ausencia" onClose={onClose}>
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
        <div className="flex flex-col gap-1">
          <label htmlFor="ausencia-tipo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Tipo
          </label>
          <Select
            id="ausencia-tipo"
            value={tipo}
            onChange={(e) => {
              const nuevoTipo = e.target.value as TipoAusencia;
              setTipo(nuevoTipo);
              setConGoceDeSueldo(tiposConfig?.find((c) => c.tipo === nuevoTipo)?.conGoceDeSueldoPorDefecto ?? CON_GOCE_POR_DEFECTO[nuevoTipo]);
            }}
          >
            {tiposActivos.map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_TIPO[t]}
              </option>
            ))}
          </Select>
        </div>
        {tipo === 'VACACIONES' && empleado && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {balance
              ? `Balance disponible: ${balance.diasDisponibles} día(s) (${balance.aniosCompletos} año(s) de antigüedad, ${balance.diasAcumulados} acumulado(s))`
              : 'Calculando balance de vacaciones…'}
          </p>
        )}
        {tipo !== 'VACACIONES' && configTipoActual?.maximoDiasPorAnio != null && (
          <p className="text-sm text-slate-600 dark:text-slate-400">Tope configurado: {configTipoActual.maximoDiasPorAnio} día(s)/año.</p>
        )}
        {configTipoActual?.requiereAprobacion === false && (
          <p className="text-sm text-amber-600 dark:text-amber-400">Este tipo se auto-aprueba al solicitarse.</p>
        )}
        <FormField id="ausencia-desde" label="Desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} required />
        <FormField id="ausencia-hasta" label="Hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} required />
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={conGoceDeSueldo} onChange={(e) => setConGoceDeSueldo(e.target.checked)} />
          Con goce de sueldo (no descuenta salario en nómina)
        </label>
        <FormField id="ausencia-motivo" label="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Guardando…' : 'Solicitar ausencia'}
        </Button>
      </form>
    </Modal>
  );
}
