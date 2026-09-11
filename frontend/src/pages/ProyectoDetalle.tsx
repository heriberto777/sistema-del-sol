import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { EditarProyectoModal } from '../components/organisms/EditarProyectoModal/EditarProyectoModal';
import { ProyectoHitosTab } from '../components/organisms/ProyectoHitosTab/ProyectoHitosTab';
import { KanbanTareas } from '../components/organisms/KanbanTareas/KanbanTareas';
import { useAuth } from '../hooks/useAuth';
import {
  ESTADOS_PROYECTO,
  ESTADOS_TAREA,
  ETIQUETA_ESTADO_HITO,
  ETIQUETA_ESTADO_PROYECTO,
  ETIQUETA_ESTADO_TAREA,
  ProyectoDetalleDto,
} from '../types/proyectos';

interface Rentabilidad {
  facturado: number;
  costoHoras: number;
  costoGastos: number;
  costoTotal: number;
  margen: number;
  margenPorcentaje: number | null;
}

const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'tablero', etiqueta: 'Tablero' },
  { id: 'hitos', etiqueta: 'Hitos' },
  { id: 'rentabilidad', etiqueta: 'Rentabilidad' },
] as const;
type PestanaId = (typeof PESTANAS)[number]['id'];

export function ProyectoDetalle() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const puedeVerRentabilidad = tienePermiso('proyectos.rentabilidad.ver');
  const [pestana, setPestana] = useState<PestanaId>('resumen');
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeFactura, setMensajeFactura] = useState<string | null>(null);

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['proyecto', id],
    queryFn: async () => (await apiClient.get<ProyectoDetalleDto>(`/admin/proyectos/${id}`)).data,
    enabled: !!id,
  });

  const { data: rentabilidad } = useQuery({
    queryKey: ['proyecto-rentabilidad', id],
    queryFn: async () => (await apiClient.get<Rentabilidad>(`/admin/proyectos/${id}/rentabilidad`)).data,
    enabled: !!id && puedeVerRentabilidad,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['proyecto', id] });

  const cambiarEstadoProyecto = useMutation({
    mutationFn: async (estado: string) => apiClient.patch(`/admin/proyectos/${id}`, { estado }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el estado.')),
  });

  if (isLoading || !proyecto) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  const tareasPorEstado = ESTADOS_TAREA.map((estado) => ({
    estado,
    etiqueta: ETIQUETA_ESTADO_TAREA[estado],
    cantidad: proyecto.tareas.filter((t) => t.estado === estado).length,
  }));
  const hitosPendientesFacturar = proyecto.hitos.filter((h) => !h.facturaId).length;

  return (
    <RequierePermiso permiso="proyectos.ver">
      <div className="space-y-4">
        <Link to="/proyectos" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft size={14} /> Volver a Proyectos
        </Link>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{proyecto.nombre}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Cliente: {proyecto.cliente.nombre} {proyecto.responsable && `· Responsable: ${proyecto.responsable.nombre}`}
              </p>
              {proyecto.presupuesto && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Presupuesto: RD$ {Number(proyecto.presupuesto).toLocaleString('es-DO')}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select value={proyecto.estado} onChange={(e) => cambiarEstadoProyecto.mutate(e.target.value)} className="w-auto">
                {ESTADOS_PROYECTO.map((estado) => (
                  <option key={estado} value={estado}>
                    {ETIQUETA_ESTADO_PROYECTO[estado]}
                  </option>
                ))}
              </Select>
              <RequierePermiso permiso="proyectos.editar">
                <Button variante="secundario" onClick={() => setModalEditarAbierto(true)}>
                  Editar
                </Button>
              </RequierePermiso>
            </div>
          </div>
        </Card>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {mensajeFactura && <p className="text-sm text-emerald-600 dark:text-emerald-400">{mensajeFactura}</p>}

        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={clsx(
                'shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
                pestana === p.id
                  ? 'border-sol-500 text-sol-600 dark:text-sol-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400',
              )}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        {pestana === 'resumen' && (
          <div className="space-y-4">
            <Card titulo="Detalle">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Descripción</p>
                  <p className="text-sm text-slate-900 dark:text-slate-100">{proyecto.descripcion || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Modo de facturación</p>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {proyecto.modoFacturacion === 'POR_HORAS' ? 'Por horas trabajadas' : 'Precio fijo por hito'}
                    {proyecto.modoFacturacion === 'POR_HORAS' &&
                      proyecto.tarifaHoraFacturable &&
                      ` (RD$ ${Number(proyecto.tarifaHoraFacturable).toLocaleString('es-DO')}/h)`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fecha de inicio</p>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {proyecto.fechaInicio ? new Date(proyecto.fechaInicio).toLocaleDateString('es-DO') : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fecha fin estimada</p>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {proyecto.fechaFinEstimada ? new Date(proyecto.fechaFinEstimada).toLocaleDateString('es-DO') : '—'}
                  </p>
                </div>
              </div>
            </Card>

            <Card titulo="Tareas por estado">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tareasPorEstado.map((t) => (
                  <div key={t.estado} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.etiqueta}</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.cantidad}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card titulo="Hitos">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {proyecto.hitos.length} hito(s) en total
                {hitosPendientesFacturar > 0 && ` · ${hitosPendientesFacturar} pendiente(s) de facturar`}
                {proyecto.hitos.length === 0 && ' — todavía no se creó ninguno.'}
              </p>
              {proyecto.hitos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {proyecto.hitos.map((h) => (
                    <span
                      key={h.id}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300"
                    >
                      {h.nombre} · {ETIQUETA_ESTADO_HITO[h.estado]}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {pestana === 'tablero' && (
          <KanbanTareas
            proyectoId={proyecto.id}
            proyectoNombre={proyecto.nombre}
            proyectoDescripcion={proyecto.descripcion}
            tareas={proyecto.tareas}
            hitos={proyecto.hitos}
            onInvalidar={invalidar}
            onError={setError}
          />
        )}

        {pestana === 'hitos' && (
          <ProyectoHitosTab
            proyectoId={proyecto.id}
            hitos={proyecto.hitos}
            tareas={proyecto.tareas}
            onInvalidar={invalidar}
            onError={setError}
            onFacturado={setMensajeFactura}
          />
        )}

        {pestana === 'rentabilidad' && (
          <RequierePermiso permiso="proyectos.rentabilidad.ver">
            {rentabilidad && (
              <Card titulo="Rentabilidad" descripcion="Facturado real vs. costo (horas + gastos asociados).">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Facturado</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      RD$ {rentabilidad.facturado.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Costo horas</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      RD$ {rentabilidad.costoHoras.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Costo gastos</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      RD$ {rentabilidad.costoGastos.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Margen</p>
                    <p className={`text-lg font-semibold ${rentabilidad.margen >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      RD$ {rentabilidad.margen.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                      {rentabilidad.margenPorcentaje !== null && ` (${rentabilidad.margenPorcentaje.toFixed(1)}%)`}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </RequierePermiso>
        )}

        {modalEditarAbierto && (
          <EditarProyectoModal proyecto={proyecto} onClose={() => setModalEditarAbierto(false)} onGuardado={() => { setModalEditarAbierto(false); invalidar(); }} />
        )}
      </div>
    </RequierePermiso>
  );
}
