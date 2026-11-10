import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { ConfirmModal } from '../../molecules/ConfirmModal/ConfirmModal';
import { CampoPin } from '../../molecules/CampoPin/CampoPin';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';
import type { Producto } from '../StockBodegasPanel/StockBodegasPanel';

// Ítem E-1 — documento Borrador→Confirmado de ajustes de inventario.
export interface AjusteInventario {
  id: string;
  numero: string;
  estado: 'BORRADOR' | 'CONFIRMADO' | 'CANCELADO';
  fecha: string;
  bodega: { nombre: string };
}

interface LineaAjusteDetalle {
  productoId: string;
  varianteId: string;
  cantidad: string;
  motivoAjuste: string;
  motivo: string | null;
  producto: Producto;
}

interface AjusteInventarioDetalle extends AjusteInventario {
  bodegaId: string;
  lineas: LineaAjusteDetalle[];
}

/**
 * Auditoría UX Fase 2 — extraído de Inventario.tsx. "Nuevo ajuste" ahora
 * navega a una página propia multi-línea (`InventarioAjusteNuevo`) en vez de
 * abrir un modal de un solo producto — el resto (ver/editar/confirmar/
 * cancelar un documento ya existente) se queda como modal, es un ajuste
 * puntual sobre un registro ya elegido de esta lista.
 */
export function AjustesInventarioPanel() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const tienePermisoAjustar = tienePermiso('inventario.ajustar');
  const queryClient = useQueryClient();
  const [paginaAjustes, setPaginaAjustes] = useState(1);
  const [ajusteViendo, setAjusteViendo] = useState<AjusteInventario | null>(null);
  const [ajusteEditando, setAjusteEditando] = useState<AjusteInventario | null>(null);
  const [ajusteConfirmando, setAjusteConfirmando] = useState<AjusteInventario | null>(null);
  const [ajusteACancelar, setAjusteACancelar] = useState<AjusteInventario | null>(null);

  const { data: ajustes } = useQuery({
    queryKey: ['ajustes-inventario', paginaAjustes],
    queryFn: async () => (await apiClient.get<PaginaResultado<AjusteInventario>>('/ajustes-inventario', { params: { pagina: paginaAjustes } })).data,
  });

  const cambiarEstadoAjuste = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'CONFIRMADO' | 'CANCELADO' }) =>
      apiClient.patch(`/ajustes-inventario/${id}/estado`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  return (
    <div className="space-y-4">
      <Card
        sinPadding
        titulo="Ajustes de inventario"
        descripcion={ajustes ? `${ajustes.total} ajuste(s) — ítem E-1, Borrador→Confirmado` : undefined}
        acciones={tienePermisoAjustar && <Button onClick={() => navigate('/inventario/ajustes/nuevo')}>Nuevo ajuste</Button>}
      >
        {ajustes?.datos.length === 0 ? (
          <p className="p-5 text-sm text-slate-500 dark:text-slate-400">
            Todavía no hay ajustes registrados — usá el botón "Nuevo ajuste" de arriba para crear el primero.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Número</th>
                  <th className="px-5 py-3 font-medium">Bodega</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ajustes?.datos.map((aj) => (
                  <tr key={aj.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{aj.numero}</td>
                    <td className="px-5 py-3">{aj.bodega.nombre}</td>
                    <td className="px-5 py-3">{new Date(aj.fecha).toLocaleDateString('es-DO')}</td>
                    <td className="px-5 py-3">
                      <Badge tono={aj.estado === 'CONFIRMADO' ? 'exito' : aj.estado === 'CANCELADO' ? 'peligro' : 'neutro'}>{aj.estado}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Ver detalle', onClick: () => setAjusteViendo(aj) },
                          ...(aj.estado === 'BORRADOR' && tienePermisoAjustar
                            ? [
                                { etiqueta: 'Editar', onClick: () => setAjusteEditando(aj) },
                                { etiqueta: 'Confirmar', onClick: () => setAjusteConfirmando(aj) },
                                {
                                  etiqueta: 'Cancelar',
                                  tono: 'peligro' as const,
                                  onClick: () => setAjusteACancelar(aj),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ajustes && (
          <div className="px-5 py-3">
            <Paginacion pagina={ajustes.pagina} tamanoPagina={ajustes.tamanoPagina} total={ajustes.total} onCambiarPagina={setPaginaAjustes} />
          </div>
        )}
      </Card>

      {ajusteViendo && <ModalVerAjuste ajuste={ajusteViendo} onClose={() => setAjusteViendo(null)} />}
      {ajusteEditando && <ModalEditarAjuste ajuste={ajusteEditando} onClose={() => setAjusteEditando(null)} />}
      {ajusteConfirmando && <ModalConfirmarAjuste ajuste={ajusteConfirmando} onClose={() => setAjusteConfirmando(null)} />}
      {ajusteACancelar && (
        <ConfirmModal
          titulo="¿Cancelar este ajuste?"
          descripcion={
            <>
              Se cancelará el ajuste <b>{ajusteACancelar.numero}</b> — queda como registro histórico, sin mover stock.
            </>
          }
          confirmarTexto="Cancelar ajuste"
          confirmando={cambiarEstadoAjuste.isPending}
          onConfirmar={() => {
            cambiarEstadoAjuste.mutate({ id: ajusteACancelar.id, estado: 'CANCELADO' });
            setAjusteACancelar(null);
          }}
          onCancelar={() => setAjusteACancelar(null)}
        />
      )}
    </div>
  );
}

function ModalVerAjuste({ ajuste, onClose }: { ajuste: AjusteInventario; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['ajuste-inventario', ajuste.id],
    queryFn: async () => (await apiClient.get<AjusteInventarioDetalle>(`/ajustes-inventario/${ajuste.id}`)).data,
  });

  return (
    <Modal titulo={`Ajuste de inventario — ${ajuste.numero}`} onClose={onClose}>
      {!data ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            <p>
              Bodega: <span className="font-medium">{data.bodega.nombre}</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Fecha: {new Date(data.fecha).toLocaleDateString('es-DO')} — Estado: <Badge>{data.estado}</Badge>
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.lineas.map((linea, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      {linea.producto.codigo} — {linea.producto.nombre}
                    </td>
                    <td className="px-3 py-2">{Number(linea.cantidad)}</td>
                    <td className="px-3 py-2">{linea.motivo ?? linea.motivoAjuste}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Ítem E-1 — editar un ajuste en BORRADOR (la bodega no se puede cambiar, solo la cantidad/motivo de cada línea existente — agregar/quitar líneas solo al crear, ver InventarioAjusteNuevo). */
function ModalEditarAjuste({ ajuste, onClose }: { ajuste: AjusteInventario; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [lineas, setLineas] = useState<{ productoId: string; cantidad: string; motivoAjuste: string; motivo: string; nombreProducto: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['ajuste-inventario', ajuste.id],
    queryFn: async () => (await apiClient.get<AjusteInventarioDetalle>(`/ajustes-inventario/${ajuste.id}`)).data,
  });

  useEffect(() => {
    if (detalle && lineas.length === 0) {
      setLineas(
        detalle.lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: String(l.cantidad),
          motivoAjuste: l.motivoAjuste,
          motivo: l.motivo ?? '',
          nombreProducto: `${l.producto.codigo} — ${l.producto.nombre}`,
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle]);

  function actualizarLinea(i: number, cambios: Partial<(typeof lineas)[number]>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/ajustes-inventario/${ajuste.id}`, {
        lineas: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: Number(l.cantidad),
          motivoAjuste: l.motivoAjuste,
          motivo: l.motivo || undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['ajuste-inventario', ajuste.id] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el ajuste. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <Modal titulo={`Editar ajuste — ${ajuste.numero}`} onClose={onClose} ancho="xl">
      {!detalle ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {/* Alto fijo + scroll propio (mismo criterio que el panel de notas de Proyectos/Mis Tareas) — antes crecía sin límite con cada línea. */}
          <div className="max-h-[24rem] space-y-2 overflow-y-auto pr-1">
            {lineas.map((linea, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{linea.nombreProducto}</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Cantidad"
                    value={linea.cantidad}
                    onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                    className="w-28 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <Select value={linea.motivoAjuste} onChange={(e) => actualizarLinea(i, { motivoAjuste: e.target.value })} required>
                    <option value="MERMA">Merma</option>
                    <option value="ROBO_PERDIDA">Robo o pérdida</option>
                    <option value="DANO">Daño</option>
                    <option value="VENCIMIENTO">Vencimiento</option>
                    <option value="CORRECCION_CONTEO">Corrección de conteo</option>
                    <option value="OTRO">Otro</option>
                  </Select>
                </div>
                <FormField
                  id={`ajuste-editar-motivo-${i}`}
                  label="Detalle (opcional)"
                  value={linea.motivo}
                  onChange={(e) => actualizarLinea(i, { motivo: e.target.value })}
                />
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </form>
      )}
    </Modal>
  );
}

/** Ítem E-1 — Confirmar dispara el movimiento real de stock; pide PIN (Fase 9) solo si alguna línea es una salida (cantidad negativa). */
function ModalConfirmarAjuste({ ajuste, onClose }: { ajuste: AjusteInventario; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['ajuste-inventario', ajuste.id],
    queryFn: async () => (await apiClient.get<AjusteInventarioDetalle>(`/ajustes-inventario/${ajuste.id}`)).data,
  });

  const tieneSalida = detalle?.lineas.some((l) => Number(l.cantidad) < 0) ?? false;

  const confirmar = useMutation({
    mutationFn: async () => apiClient.patch(`/ajustes-inventario/${ajuste.id}/estado`, { estado: 'CONFIRMADO', pin: pin || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ajustes-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo confirmar el ajuste.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    confirmar.mutate();
  }

  return (
    <Modal titulo={`Confirmar ajuste — ${ajuste.numero}`} onClose={onClose}>
      {!detalle ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Al confirmar, este ajuste se aplica de verdad al stock de {detalle.bodega.nombre} — ya no se podrá editar.
          </p>
          {tieneSalida && <CampoPin value={pin} onChange={setPin} id="ajuste-confirmar-pin" />}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" disabled={confirmar.isPending} className="w-full">
            {confirmar.isPending ? 'Confirmando…' : 'Confirmar ajuste'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
