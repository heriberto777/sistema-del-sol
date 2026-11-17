import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { ConfirmModal } from '../../molecules/ConfirmModal/ConfirmModal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

// Ítem E-1 — documento Borrador→Confirmado de transferencias entre bodegas.
export interface TransferenciaInventario {
  id: string;
  numero: string;
  estado: 'BORRADOR' | 'CONFIRMADO' | 'CANCELADO';
  fecha: string;
  bodegaOrigen: { nombre: string };
  bodegaDestino: { nombre: string };
}

/**
 * Auditoría UX Fase 2 — extraído de Inventario.tsx. "Nueva transferencia"
 * navega a una página propia multi-línea (`InventarioTransferenciaNueva`).
 * "Ver detalle"/"Editar" (auditoría de modales pendientes) navegan a
 * `InventarioTransferenciaVer` — solo Cancelar se queda como modal.
 */
export function TransferenciasInventarioPanel() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const tienePermisoTransferir = tienePermiso('inventario.transferir');
  const queryClient = useQueryClient();
  const [paginaTransferencias, setPaginaTransferencias] = useState(1);
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
                          { etiqueta: 'Ver detalle', onClick: () => navigate(`/inventario/transferencias/${tr.id}`) },
                          ...(tr.estado === 'BORRADOR' && tienePermisoTransferir
                            ? [
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

