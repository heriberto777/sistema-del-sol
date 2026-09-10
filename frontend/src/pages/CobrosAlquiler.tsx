import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Select } from '../components/atoms/Select/Select';
import { Button } from '../components/atoms/Button/Button';
import { Modal } from '../components/molecules/Modal/Modal';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { PaginaResultado } from '../types/pagina-resultado';
import { CobroAlquiler, ESTADOS_COBRO_ALQUILER, ETIQUETA_ESTADO_COBRO_ALQUILER } from '../types/inmobiliaria';

const TONO_ESTADO_COBRO: Record<string, 'exito' | 'advertencia' | 'neutro'> = {
  PENDIENTE: 'advertencia',
  COBRADO: 'neutro',
  LIQUIDADO: 'exito',
};

function MarcarCobradoModal({
  cobro,
  guardando,
  error,
  onClose,
  onConfirmar,
}: {
  cobro: CobroAlquiler;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onConfirmar: (generarFactura: boolean, aplicaItbis: boolean) => void;
}) {
  const [generarFactura, setGenerarFactura] = useState(false);
  const [aplicaItbis, setAplicaItbis] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onConfirmar(generarFactura, aplicaItbis);
  }

  return (
    <Modal titulo={`Marcar cobrado — ${cobro.periodo}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {cobro.contratoPropiedad.propiedad.titulo} — {cobro.contratoPropiedad.cliente.nombre}
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={generarFactura} onChange={(e) => setGenerarFactura(e.target.checked)} className="rounded border-slate-300" />
          Generar Factura real (con NCF o e-CF según la configuración del tenant)
        </label>
        {!generarFactura && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            Sin marcar esta opción, el cobro queda como registro interno — sin ningún comprobante fiscal.
          </p>
        )}
        {generarFactura && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={aplicaItbis} onChange={(e) => setAplicaItbis(e.target.checked)} className="rounded border-slate-300" />
            Aplica ITBIS (el alquiler suele estar exento)
          </label>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Confirmar cobro'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CobrosAlquiler() {
  const { tienePermiso } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const contratoPropiedadId = searchParams.get('contratoPropiedadId') ?? undefined;
  const [pagina, setPagina] = useState(1);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cobroACobrar, setCobroACobrar] = useState<CobroAlquiler | null>(null);
  const [error, setError] = useState<string | null>(null);
  const puedeGestionar = tienePermiso('inmobiliaria.alquileres.gestionar');

  useEffect(() => setPagina(1), [filtroEstado, contratoPropiedadId]);

  const { data, isLoading } = useQuery({
    queryKey: ['inmobiliaria-cobros-alquiler', pagina, filtroEstado, contratoPropiedadId],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<CobroAlquiler>>('/admin/inmobiliaria/alquileres', {
          params: { pagina, estado: filtroEstado || undefined, contratoPropiedadId },
        })
      ).data,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['inmobiliaria-cobros-alquiler'] });

  const marcarCobrado = useMutation({
    mutationFn: async ({ generarFactura, aplicaItbis }: { generarFactura: boolean; aplicaItbis: boolean }) =>
      apiClient.patch(`/admin/inmobiliaria/alquileres/${cobroACobrar?.id}/cobrado`, { generarFactura, aplicaItbis }),
    onSuccess: () => {
      setCobroACobrar(null);
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo marcar el cobro.')),
  });

  const liquidar = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/admin/inmobiliaria/alquileres/${id}/liquidar`),
    onSuccess: () => {
      setError(null);
      invalidar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo liquidar al propietario.')),
  });

  const cobros = data?.datos ?? [];

  return (
    <RequierePermiso permiso="inmobiliaria.alquileres.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Alquileres administrados</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cobros mensuales de renta generados automáticamente — cobrar al inquilino y liquidar al propietario.</p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Card sinPadding>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="!w-auto">
              <option value="">Todos los estados</option>
              {ESTADOS_COBRO_ALQUILER.map((es) => (
                <option key={es} value={es}>
                  {ETIQUETA_ESTADO_COBRO_ALQUILER[es]}
                </option>
              ))}
            </Select>
          </div>

          {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && cobros.length === 0 && (
            <div className="p-5">
              <EstadoVacio
                titulo="Sin cobros todavía"
                descripcion="Activá la administración de un contrato de alquiler desde Contratos — los cobros se generan solos, un mes a la vez."
              />
            </div>
          )}
          {cobros.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Período</th>
                    <th className="px-5 py-3 font-medium">Propiedad</th>
                    <th className="px-5 py-3 font-medium">Inquilino</th>
                    <th className="px-5 py-3 font-medium">Alquiler</th>
                    <th className="px-5 py-3 font-medium">Comisión admin.</th>
                    <th className="px-5 py-3 font-medium">Propietario recibe</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cobros.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-medium tabular-nums text-slate-900 dark:text-slate-100">{c.periodo}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{c.contratoPropiedad.propiedad.titulo}</p>
                        <p className="text-xs text-slate-400">Cód. {c.contratoPropiedad.propiedad.codigo}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{c.contratoPropiedad.cliente.nombre}</td>
                      <td className="px-5 py-3 font-medium tabular-nums">{Number(c.montoAlquiler).toLocaleString('es-DO')}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-500 dark:text-slate-400">
                        {Number(c.montoComisionAdmin).toLocaleString('es-DO')}
                        {c.porcentajeComisionAdmin && <span className="text-xs"> ({c.porcentajeComisionAdmin}%)</span>}
                      </td>
                      <td className="px-5 py-3 font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {Number(c.montoPropietario).toLocaleString('es-DO')}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tono={TONO_ESTADO_COBRO[c.estado] ?? 'neutro'}>{ETIQUETA_ESTADO_COBRO_ALQUILER[c.estado] ?? c.estado}</Badge>
                        {c.facturaId && <p className="mt-1 text-xs text-slate-400">Con Factura</p>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {puedeGestionar && (
                          <div className="flex justify-end gap-2">
                            {c.estado === 'PENDIENTE' && (
                              <Button type="button" variante="secundario" onClick={() => setCobroACobrar(c)}>
                                Marcar cobrado
                              </Button>
                            )}
                            {c.estado === 'COBRADO' && (
                              <Button type="button" variante="secundario" onClick={() => liquidar.mutate(c.id)} disabled={liquidar.isPending}>
                                Liquidar propietario
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

        {cobroACobrar && (
          <MarcarCobradoModal
            cobro={cobroACobrar}
            guardando={marcarCobrado.isPending}
            error={error}
            onClose={() => {
              setCobroACobrar(null);
              setError(null);
            }}
            onConfirmar={(generarFactura, aplicaItbis) => marcarCobrado.mutate({ generarFactura, aplicaItbis })}
          />
        )}
      </div>
    </RequierePermiso>
  );
}
