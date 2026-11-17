import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
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
 * Auditoría UX Fase 2 — extraído de Inventario.tsx. "Nuevo ajuste" navega a
 * una página propia multi-línea (`InventarioAjusteNuevo`). "Ver
 * detalle"/"Editar" (auditoría de modales pendientes) navegan a
 * `InventarioAjusteVer` — solo Confirmar/Cancelar (transición de estado de
 * un registro ya elegido en esta lista) se quedan como modal.
 */
export function AjustesInventarioPanel() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const tienePermisoAjustar = tienePermiso('inventario.ajustar');
  const queryClient = useQueryClient();
  const [paginaAjustes, setPaginaAjustes] = useState(1);
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
                          { etiqueta: 'Ver detalle', onClick: () => navigate(`/inventario/ajustes/${aj.id}`) },
                          ...(aj.estado === 'BORRADOR' && tienePermisoAjustar
                            ? [
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
