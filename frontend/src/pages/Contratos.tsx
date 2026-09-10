import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Select } from '../components/atoms/Select/Select';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { PaginaResultado } from '../types/pagina-resultado';
import { AgenteOpcion, Contrato, ESTADOS_CONTRATO, ETIQUETA_ESTADO_CONTRATO, ETIQUETA_OPERACION_PROPIEDAD, OPERACIONES_PROPIEDAD } from '../types/inmobiliaria';

/** Modelo 2 — activar/pausar la administración recurrente de un alquiler ya cerrado. */
function AdministracionAlquilerModal({
  contrato,
  guardando,
  error,
  onClose,
  onActivar,
  onDesactivar,
}: {
  contrato: Contrato;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onActivar: (porcentaje: number) => void;
  onDesactivar: () => void;
}) {
  const [porcentaje, setPorcentaje] = useState(contrato.porcentajeComisionAdministracion ?? '10');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onActivar(Number(porcentaje));
  }

  if (!contrato.propiedad.propietarioId) {
    return (
      <Modal titulo="Administración de alquiler" onClose={onClose}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Esta propiedad no tiene un propietario asignado — asignalo desde Propiedades (campo "Propietario") antes de activar la administración recurrente.
        </p>
        <div className="flex justify-end pt-4">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </Modal>
    );
  }

  if (contrato.administracionActiva) {
    return (
      <Modal titulo="Administración de alquiler" onClose={onClose}>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>
            Administración <b>activa</b> — comisión de administración: <b>{contrato.porcentajeComisionAdministracion}%</b>.
          </p>
          {contrato.proximoCobroAlquilerEn && (
            <p>Próximo cobro: {new Date(contrato.proximoCobroAlquilerEn).toLocaleDateString('es-DO')}</p>
          )}
          <p className="text-xs text-slate-400">
            El cobro mensual se genera solo (todos los días a las 8am). Los cobros generados están en{' '}
            <Link to={`/alquileres?contratoPropiedadId=${contrato.id}`} className="text-teal-700 hover:underline dark:text-teal-400">
              Alquileres administrados
            </Link>
            .
          </p>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" variante="peligro" disabled={guardando} onClick={onDesactivar}>
            {guardando ? 'Pausando…' : 'Pausar administración'}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo="Activar administración de alquiler" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          A partir de hoy se genera un cobro mensual de renta para este contrato. El propietario (
          <b>{contrato.propiedad.propietarioId ? 'ya asignado' : 'sin asignar'}</b>) recibe el alquiler cobrado menos la
          comisión de administración.
        </p>
        <FormField
          id="admin-alquiler-pct"
          label="% de comisión de administración"
          type="number"
          min="0"
          max="100"
          step="0.1"
          required
          value={porcentaje}
          onChange={(e) => setPorcentaje(e.target.value)}
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Activando…' : 'Activar administración'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function Contratos() {
  const { tienePermiso } = useAuth();
  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroAgente, setFiltroAgente] = useState('');
  const [contratoAAnular, setContratoAAnular] = useState<Contrato | null>(null);
  const [contratoAAdministrar, setContratoAAdministrar] = useState<Contrato | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAdministracion, setErrorAdministracion] = useState<string | null>(null);
  const puedeAnular = tienePermiso('inmobiliaria.contratos.anular');
  const puedeGestionar = tienePermiso('inmobiliaria.contratos.crear');
  const puedeGestionarAlquileres = tienePermiso('inmobiliaria.alquileres.gestionar');

  useEffect(() => setPagina(1), [filtroEstado, filtroTipo, filtroAgente]);

  const { data, isLoading } = useQuery({
    queryKey: ['inmobiliaria-contratos', pagina, filtroEstado, filtroTipo, filtroAgente],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Contrato>>('/admin/inmobiliaria/contratos', {
          params: { pagina, estado: filtroEstado || undefined, tipo: filtroTipo || undefined, agenteId: filtroAgente || undefined },
        })
      ).data,
  });

  const { data: agentes } = useQuery({
    queryKey: ['inmobiliaria-agentes-opciones'],
    queryFn: async () => (await apiClient.get<AgenteOpcion[]>('/admin/inmobiliaria/propiedades/agentes')).data,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['inmobiliaria-contratos'] });

  const marcarPagada = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/admin/inmobiliaria/contratos/${id}/comision-pagada`),
    onSuccess: () => {
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo marcar la comisión como pagada.')),
  });

  const anular = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/admin/inmobiliaria/contratos/${id}/anular`),
    onSuccess: () => {
      setContratoAAnular(null);
      setError(null);
      invalidar();
    },
    onError: (err) => {
      setError(mensajeErrorApi(err, 'No se pudo anular el contrato.'));
      setContratoAAnular(null);
    },
  });

  const activarAdministracion = useMutation({
    mutationFn: async (porcentaje: number) =>
      apiClient.patch(`/admin/inmobiliaria/contratos/${contratoAAdministrar?.id}/administracion-alquiler`, {
        porcentajeComisionAdministracion: porcentaje,
      }),
    onSuccess: () => {
      setContratoAAdministrar(null);
      setErrorAdministracion(null);
      invalidar();
    },
    onError: (err) => setErrorAdministracion(mensajeErrorApi(err, 'No se pudo activar la administración.')),
  });

  const desactivarAdministracion = useMutation({
    mutationFn: async () => apiClient.delete(`/admin/inmobiliaria/contratos/${contratoAAdministrar?.id}/administracion-alquiler`),
    onSuccess: () => {
      setContratoAAdministrar(null);
      setErrorAdministracion(null);
      invalidar();
    },
    onError: (err) => setErrorAdministracion(mensajeErrorApi(err, 'No se pudo pausar la administración.')),
  });

  const contratos = data?.datos ?? [];

  return (
    <RequierePermiso permiso="inmobiliaria.contratos.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Contratos y comisiones</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Negocios cerrados sobre propiedades — venta o alquiler.</p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Card sinPadding>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="!w-auto">
              <option value="">Todos los estados</option>
              {ESTADOS_CONTRATO.map((es) => (
                <option key={es} value={es}>
                  {ETIQUETA_ESTADO_CONTRATO[es]}
                </option>
              ))}
            </Select>
            <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="!w-auto">
              <option value="">Venta o alquiler</option>
              {OPERACIONES_PROPIEDAD.map((o) => (
                <option key={o} value={o}>
                  {ETIQUETA_OPERACION_PROPIEDAD[o]}
                </option>
              ))}
            </Select>
            <Select value={filtroAgente} onChange={(e) => setFiltroAgente(e.target.value)} className="!w-auto">
              <option value="">Todos los agentes</option>
              {agentes?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </Select>
          </div>

          {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && contratos.length === 0 && (
            <div className="p-5">
              <EstadoVacio titulo="Sin contratos todavía" descripcion="Cerrá un negocio desde Propiedades para verlo acá." />
            </div>
          )}
          {contratos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Propiedad</th>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Tipo</th>
                    <th className="px-5 py-3 font-medium">Monto</th>
                    <th className="px-5 py-3 font-medium">Agente</th>
                    <th className="px-5 py-3 font-medium">Comisión</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {contratos.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{c.propiedad.titulo}</p>
                        <p className="text-xs text-slate-400">Cód. {c.propiedad.codigo}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{c.cliente.nombre}</td>
                      <td className="px-5 py-3">
                        <Badge tono={c.tipo === 'ALQUILER' ? 'advertencia' : 'neutro'}>{ETIQUETA_OPERACION_PROPIEDAD[c.tipo] ?? c.tipo}</Badge>
                      </td>
                      <td className="px-5 py-3 font-medium tabular-nums">
                        {c.moneda === 'DOP' ? 'RD$' : 'US$'} {Number(c.monto).toLocaleString('es-DO')}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{c.agente?.nombre ?? '—'}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                          {c.moneda === 'DOP' ? 'RD$' : 'US$'} {Number(c.montoComision).toLocaleString('es-DO')}
                        </p>
                        {Number(c.montoComision) > 0 && (
                          <Badge tono={c.comisionPagada ? 'exito' : 'advertencia'}>{c.comisionPagada ? 'Pagada' : 'Pendiente'}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tono={c.estado === 'ANULADO' ? 'peligro' : 'exito'}>{ETIQUETA_ESTADO_CONTRATO[c.estado] ?? c.estado}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {c.estado === 'ACTIVO' && (
                          <div className="flex justify-end gap-2">
                            {puedeGestionar && !c.comisionPagada && Number(c.montoComision) > 0 && (
                              <Button type="button" variante="secundario" onClick={() => marcarPagada.mutate(c.id)} disabled={marcarPagada.isPending}>
                                Marcar pagada
                              </Button>
                            )}
                            {puedeGestionarAlquileres && c.tipo === 'ALQUILER' && (
                              <Button type="button" variante="secundario" onClick={() => setContratoAAdministrar(c)}>
                                {c.administracionActiva ? 'Administración' : 'Administrar alquiler'}
                              </Button>
                            )}
                            {puedeAnular && (
                              <Button type="button" variante="secundario" onClick={() => setContratoAAnular(c)}>
                                Anular
                              </Button>
                            )}
                          </div>
                        )}
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

        {contratoAAnular && (
          <ConfirmModal
            titulo="¿Anular este contrato?"
            descripcion={
              <>
                Se anulará el negocio sobre <b>{contratoAAnular.propiedad.titulo}</b> y la propiedad vuelve a quedar Activa
                en el catálogo.
              </>
            }
            confirmando={anular.isPending}
            onConfirmar={() => anular.mutate(contratoAAnular.id)}
            onCancelar={() => setContratoAAnular(null)}
          />
        )}

        {contratoAAdministrar && (
          <AdministracionAlquilerModal
            contrato={contratoAAdministrar}
            guardando={activarAdministracion.isPending || desactivarAdministracion.isPending}
            error={errorAdministracion}
            onClose={() => {
              setContratoAAdministrar(null);
              setErrorAdministracion(null);
            }}
            onActivar={(porcentaje) => activarAdministracion.mutate(porcentaje)}
            onDesactivar={() => desactivarAdministracion.mutate()}
          />
        )}
      </div>
    </RequierePermiso>
  );
}
