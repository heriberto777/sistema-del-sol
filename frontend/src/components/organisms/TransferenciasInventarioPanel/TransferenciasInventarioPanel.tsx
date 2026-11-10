import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Modal } from '../../molecules/Modal/Modal';
import { ConfirmModal } from '../../molecules/ConfirmModal/ConfirmModal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';
import type { Producto } from '../StockBodegasPanel/StockBodegasPanel';

// Ítem E-1 — documento Borrador→Confirmado de transferencias entre bodegas.
export interface TransferenciaInventario {
  id: string;
  numero: string;
  estado: 'BORRADOR' | 'CONFIRMADO' | 'CANCELADO';
  fecha: string;
  bodegaOrigen: { nombre: string };
  bodegaDestino: { nombre: string };
}

interface LineaTransferenciaDetalle {
  productoId: string;
  varianteId: string;
  cantidad: string;
  producto: Producto;
}

interface TransferenciaInventarioDetalle extends TransferenciaInventario {
  bodegaOrigenId: string;
  bodegaDestinoId: string;
  lineas: LineaTransferenciaDetalle[];
}

/**
 * Auditoría UX Fase 2 — extraído de Inventario.tsx. "Nueva transferencia"
 * ahora navega a una página propia multi-línea (`InventarioTransferenciaNueva`)
 * en vez de abrir un modal de un solo producto.
 */
export function TransferenciasInventarioPanel() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const tienePermisoTransferir = tienePermiso('inventario.transferir');
  const queryClient = useQueryClient();
  const [paginaTransferencias, setPaginaTransferencias] = useState(1);
  const [transferenciaViendo, setTransferenciaViendo] = useState<TransferenciaInventario | null>(null);
  const [transferenciaEditando, setTransferenciaEditando] = useState<TransferenciaInventario | null>(null);
  const [transferenciaACancelar, setTransferenciaACancelar] = useState<TransferenciaInventario | null>(null);

  const { data: transferencias } = useQuery({
    queryKey: ['transferencias-inventario', paginaTransferencias],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<TransferenciaInventario>>('/transferencias-inventario', { params: { pagina: paginaTransferencias } })).data,
  });

  const cambiarEstadoTransferencia = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'CONFIRMADO' | 'CANCELADO' }) =>
      apiClient.patch(`/transferencias-inventario/${id}/estado`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  return (
    <div className="space-y-4">
      <Card
        sinPadding
        titulo="Transferencias de inventario"
        descripcion={transferencias ? `${transferencias.total} transferencia(s) — ítem E-1, Borrador→Confirmado` : undefined}
        acciones={tienePermisoTransferir && <Button onClick={() => navigate('/inventario/transferencias/nuevo')}>Nueva transferencia</Button>}
      >
        {transferencias?.datos.length === 0 ? (
          <p className="p-5 text-sm text-slate-500 dark:text-slate-400">
            Todavía no hay transferencias registradas — usá el botón "Nueva transferencia" de arriba para crear la primera.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Número</th>
                  <th className="px-5 py-3 font-medium">Origen</th>
                  <th className="px-5 py-3 font-medium">Destino</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transferencias?.datos.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">{tr.numero}</td>
                    <td className="px-5 py-3">{tr.bodegaOrigen.nombre}</td>
                    <td className="px-5 py-3">{tr.bodegaDestino.nombre}</td>
                    <td className="px-5 py-3">{new Date(tr.fecha).toLocaleDateString('es-DO')}</td>
                    <td className="px-5 py-3">
                      <Badge tono={tr.estado === 'CONFIRMADO' ? 'exito' : tr.estado === 'CANCELADO' ? 'peligro' : 'neutro'}>{tr.estado}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Ver detalle', onClick: () => setTransferenciaViendo(tr) },
                          ...(tr.estado === 'BORRADOR' && tienePermisoTransferir
                            ? [
                                { etiqueta: 'Editar', onClick: () => setTransferenciaEditando(tr) },
                                {
                                  etiqueta: 'Confirmar',
                                  onClick: () => cambiarEstadoTransferencia.mutate({ id: tr.id, estado: 'CONFIRMADO' }),
                                },
                                {
                                  etiqueta: 'Cancelar',
                                  tono: 'peligro' as const,
                                  onClick: () => setTransferenciaACancelar(tr),
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
        {transferencias && (
          <div className="px-5 py-3">
            <Paginacion
              pagina={transferencias.pagina}
              tamanoPagina={transferencias.tamanoPagina}
              total={transferencias.total}
              onCambiarPagina={setPaginaTransferencias}
            />
          </div>
        )}
      </Card>

      {transferenciaViendo && <ModalVerTransferencia transferencia={transferenciaViendo} onClose={() => setTransferenciaViendo(null)} />}
      {transferenciaEditando && <ModalEditarTransferencia transferencia={transferenciaEditando} onClose={() => setTransferenciaEditando(null)} />}
      {transferenciaACancelar && (
        <ConfirmModal
          titulo="¿Cancelar esta transferencia?"
          descripcion={
            <>
              Se cancelará la transferencia <b>{transferenciaACancelar.numero}</b>.
            </>
          }
          confirmarTexto="Cancelar transferencia"
          confirmando={cambiarEstadoTransferencia.isPending}
          onConfirmar={() => {
            cambiarEstadoTransferencia.mutate({ id: transferenciaACancelar.id, estado: 'CANCELADO' });
            setTransferenciaACancelar(null);
          }}
          onCancelar={() => setTransferenciaACancelar(null)}
        />
      )}
    </div>
  );
}

function ModalVerTransferencia({ transferencia, onClose }: { transferencia: TransferenciaInventario; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['transferencia-inventario', transferencia.id],
    queryFn: async () => (await apiClient.get<TransferenciaInventarioDetalle>(`/transferencias-inventario/${transferencia.id}`)).data,
  });

  return (
    <Modal titulo={`Transferencia de inventario — ${transferencia.numero}`} onClose={onClose}>
      {!data ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            <p>
              De <span className="font-medium">{data.bodegaOrigen.nombre}</span> a{' '}
              <span className="font-medium">{data.bodegaDestino.nombre}</span>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.lineas.map((linea, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      {linea.producto.codigo} — {linea.producto.nombre}
                    </td>
                    <td className="px-3 py-2">{Number(linea.cantidad)}</td>
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

/** Ítem E-1 — editar una transferencia en BORRADOR (las bodegas no se pueden cambiar, solo la cantidad de cada línea existente). */
function ModalEditarTransferencia({ transferencia, onClose }: { transferencia: TransferenciaInventario; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [lineas, setLineas] = useState<{ productoId: string; cantidad: string; nombreProducto: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['transferencia-inventario', transferencia.id],
    queryFn: async () => (await apiClient.get<TransferenciaInventarioDetalle>(`/transferencias-inventario/${transferencia.id}`)).data,
  });

  useEffect(() => {
    if (detalle && lineas.length === 0) {
      setLineas(
        detalle.lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: String(l.cantidad),
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
      apiClient.patch(`/transferencias-inventario/${transferencia.id}`, {
        lineas: lineas.map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['transferencia-inventario', transferencia.id] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la transferencia. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <Modal titulo={`Editar transferencia — ${transferencia.numero}`} onClose={onClose}>
      {!detalle ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {lineas.map((linea, i) => (
            <div key={i} className="flex items-center gap-2">
              <p className="flex-1 text-sm text-slate-700 dark:text-slate-300">{linea.nombreProducto}</p>
              <input
                type="number"
                min={1}
                placeholder="Cantidad"
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
