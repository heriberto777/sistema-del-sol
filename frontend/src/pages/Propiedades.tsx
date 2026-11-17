import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Select } from '../components/atoms/Select/Select';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';
import {
  ESTADOS_PROPIEDAD_CERRABLE,
  ETIQUETA_ESTADO_PROPIEDAD,
  ETIQUETA_OPERACION_PROPIEDAD,
  ETIQUETA_TIPO_PROPIEDAD,
  OPERACIONES_PROPIEDAD,
  Propiedad,
  TIPOS_PROPIEDAD,
} from '../types/inmobiliaria';

const TONO_ESTADO: Record<string, 'exito' | 'advertencia' | 'neutro'> = {
  ACTIVA: 'exito',
  RESERVADA: 'advertencia',
  PAUSADA: 'neutro',
  VENDIDA: 'neutro',
  ALQUILADA: 'neutro',
};

export function Propiedades() {
  const { usuario, tienePermiso } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [filtroOperacion, setFiltroOperacion] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [propiedadAEliminar, setPropiedadAEliminar] = useState<Propiedad | null>(null);
  const [propiedadADesvincularPreventa, setPropiedadADesvincularPreventa] = useState<Propiedad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const puedeCerrarNegocio = tienePermiso('inmobiliaria.contratos.crear');
  const puedeEditarPropiedad = tienePermiso('inmobiliaria.propiedades.editar');
  const puedeEliminarPropiedad = tienePermiso('inmobiliaria.propiedades.eliminar');
  const puedeCrearPreventa = tienePermiso('inmobiliaria.preventas.crear');

  useEffect(() => setPagina(1), [busquedaDebounced, filtroOperacion, filtroTipo]);

  const { data, isLoading } = useQuery({
    queryKey: ['propiedades', pagina, busquedaDebounced, filtroOperacion, filtroTipo],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Propiedad>>('/admin/inmobiliaria/propiedades', {
          params: { pagina, busqueda: busquedaDebounced || undefined, operacion: filtroOperacion || undefined, tipo: filtroTipo || undefined },
        })
      ).data,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['propiedades'] });

  const desvincularPreventa = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/inmobiliaria/propiedades/${id}/preventa`),
    onSuccess: () => {
      setPropiedadADesvincularPreventa(null);
      invalidar();
    },
    onError: (err) => {
      setError(mensajeErrorApi(err, 'No se pudo desvincular la preventa.'));
      setPropiedadADesvincularPreventa(null);
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/inmobiliaria/propiedades/${id}`),
    onSuccess: () => {
      setPropiedadAEliminar(null);
      invalidar();
    },
    onError: (err) => {
      setError(mensajeErrorApi(err, 'No se pudo eliminar la propiedad.'));
      setPropiedadAEliminar(null);
    },
  });

  const propiedades = data?.datos ?? [];

  return (
    <RequierePermiso permiso="inmobiliaria.propiedades.ver">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Propiedades</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{data ? `${data.total} propiedad(es) registradas` : 'Catálogo de venta y alquiler.'}</p>
          </div>
          <div className="flex items-center gap-2">
            {usuario?.tenant?.subdominio && (
              <Link
                to={`/inmobiliaria/${usuario.tenant.subdominio}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ExternalLink size={14} />
                Ver catálogo público
              </Link>
            )}
            <RequierePermiso permiso="inmobiliaria.propiedades.crear">
              <Button onClick={() => navigate('/propiedades/nuevo')}>+ Nueva propiedad</Button>
            </RequierePermiso>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Card sinPadding>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por título, código o ubicación…" />
            <Select value={filtroOperacion} onChange={(e) => setFiltroOperacion(e.target.value)} className="!w-auto">
              <option value="">Todas las operaciones</option>
              {OPERACIONES_PROPIEDAD.map((o) => (
                <option key={o} value={o}>
                  {ETIQUETA_OPERACION_PROPIEDAD[o]}
                </option>
              ))}
            </Select>
            <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="!w-auto">
              <option value="">Todos los tipos</option>
              {TIPOS_PROPIEDAD.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_PROPIEDAD[t]}
                </option>
              ))}
            </Select>
          </div>

          {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && propiedades.length === 0 && (
            <div className="p-5">
              <EstadoVacio titulo="Sin propiedades todavía" descripcion="Creá la primera para empezar a publicar tu catálogo." />
            </div>
          )}
          {propiedades.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Propiedad</th>
                    <th className="px-5 py-3 font-medium">Operación</th>
                    <th className="px-5 py-3 font-medium">Precio</th>
                    <th className="px-5 py-3 font-medium">Ubicación</th>
                    <th className="px-5 py-3 font-medium">Agente</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {propiedades.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.imagenes[0] ? (
                            <img src={p.imagenes[0].imagen} alt="" className="h-10 w-14 shrink-0 rounded-md object-cover" />
                          ) : (
                            <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">—</div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{p.titulo}</p>
                            <p className="text-xs text-slate-400">Cód. {p.codigo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tono={p.operacion === 'ALQUILER' ? 'advertencia' : 'neutro'}>{ETIQUETA_OPERACION_PROPIEDAD[p.operacion] ?? p.operacion}</Badge>
                      </td>
                      <td className="px-5 py-3 font-medium tabular-nums">
                        {p.moneda === 'DOP' ? 'RD$' : 'US$'} {Number(p.precio).toLocaleString('es-DO')}
                        {p.operacion === 'ALQUILER' ? '/mes' : ''}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{p.ubicacion}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{p.agente?.nombre ?? '—'}</td>
                      <td className="px-5 py-3">
                        <Badge tono={TONO_ESTADO[p.estado] ?? 'neutro'}>{ETIQUETA_ESTADO_PROPIEDAD[p.estado] ?? p.estado}</Badge>
                        {p.proyectoPreventa && (
                          <Link to={`/proyectos/${p.proyectoPreventa.id}/resumen`} className="mt-1 block text-xs text-teal-700 hover:underline dark:text-teal-400">
                            Preventa: {p.proyectoPreventa.nombre}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RowActionsMenu
                          acciones={[
                            { etiqueta: 'Ver detalle', onClick: () => navigate(`/propiedades/${p.id}`) },
                            ...(puedeCerrarNegocio && ESTADOS_PROPIEDAD_CERRABLE.has(p.estado)
                              ? [{ etiqueta: 'Cerrar negocio', onClick: () => navigate(`/propiedades/${p.id}`) }]
                              : []),
                            ...(puedeCrearPreventa && p.operacion === 'VENTA' && !p.proyectoPreventaId && ESTADOS_PROPIEDAD_CERRABLE.has(p.estado)
                              ? [{ etiqueta: 'Iniciar preventa', onClick: () => navigate(`/propiedades/${p.id}`) }]
                              : []),
                            ...(puedeCrearPreventa && p.proyectoPreventaId
                              ? [{ etiqueta: 'Desvincular preventa', tono: 'peligro' as const, onClick: () => setPropiedadADesvincularPreventa(p) }]
                              : []),
                            ...(puedeEditarPropiedad ? [{ etiqueta: 'Editar', onClick: () => navigate(`/propiedades/${p.id}`) }] : []),
                            ...(puedeEliminarPropiedad ? [{ etiqueta: 'Eliminar', tono: 'peligro' as const, onClick: () => setPropiedadAEliminar(p) }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && (
            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
              <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>

        {propiedadAEliminar && (
          <ConfirmModal
            titulo="¿Eliminar esta propiedad?"
            descripcion={
              <>
                Se eliminará <b>{propiedadAEliminar.titulo}</b> del catálogo.
              </>
            }
            confirmando={eliminar.isPending}
            onConfirmar={() => eliminar.mutate(propiedadAEliminar.id)}
            onCancelar={() => setPropiedadAEliminar(null)}
          />
        )}

        {propiedadADesvincularPreventa && (
          <ConfirmModal
            titulo="¿Desvincular la preventa?"
            descripcion={
              <>
                Se desvincula el Proyecto de <b>{propiedadADesvincularPreventa.titulo}</b> (no se elimina — seguís
                pudiendo verlo en Proyectos) y la propiedad vuelve a quedar Activa en el catálogo.
              </>
            }
            confirmando={desvincularPreventa.isPending}
            onConfirmar={() => desvincularPreventa.mutate(propiedadADesvincularPreventa.id)}
            onCancelar={() => setPropiedadADesvincularPreventa(null)}
          />
        )}
      </div>
    </RequierePermiso>
  );
}
