import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { ModalImprimir } from '../components/molecules/ModalImprimir/ModalImprimir';
import { TablaArticulosDocumento } from '../components/molecules/TablaArticulosDocumento/TablaArticulosDocumento';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { RemisionDetalle, TONO_POR_ESTADO } from '../components/organisms/RemisionesPanel/RemisionesPanel';
import { ModalConvertirRemision } from '../components/organisms/RemisionesPanel/ModalConvertirRemision';

/**
 * Auditoría UX (post Período Contable, 2026-11) — reemplaza a
 * `ModalDetalleRemision`: mismas acciones que antes vivían en el menú de
 * la fila (Editar/Marcar entregada/Convertir en factura/Anular), ahora
 * en el panel lateral, siempre visibles.
 */
export function RemisionVer() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [imprimiendo, setImprimiendo] = useState(false);
  const [convirtiendo, setConvirtiendo] = useState(false);

  const { data: remision } = useQuery({
    queryKey: ['remision-detalle-ver', id],
    queryFn: async () => (await apiClient.get<RemisionDetalle>(`/remisiones/${id}`)).data,
  });

  const cambiarEstado = useMutation({
    mutationFn: async (estado: 'ENTREGADA' | 'ANULADA') => apiClient.patch(`/remisiones/${id}/estado`, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remisiones'] });
      queryClient.invalidateQueries({ queryKey: ['remision-detalle-ver', id] });
    },
  });

  const puedeEditar = !!remision && tienePermiso('remisiones.editar') && remision.estado === 'BORRADOR';
  const puedeConvertirOAnular =
    !!remision && tienePermiso('remisiones.editar') && (remision.estado === 'BORRADOR' || remision.estado === 'ENTREGADA');

  return (
    <RequierePermiso permiso="remisiones.ver">
      <PaginaDocumento
        titulo={remision ? `Remisión ${remision.numero}` : 'Remisión'}
        rutaVolver="/remisiones"
        etiquetaVolver="Volver a Remisiones"
        haycambios={false}
        resumen={
          !remision ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
                <Badge tono={TONO_POR_ESTADO[remision.estado]}>{remision.estado}</Badge>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{remision.cliente?.nombre}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Bodega</span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{remision.bodega?.nombre ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{new Date(remision.fecha).toLocaleDateString('es-DO')}</span>
              </div>
              {remision.facturaId && <p className="text-xs text-slate-400">Ya facturada</p>}
            </>
          )
        }
        acciones={
          <>
            <Button type="button" variante="secundario" className="w-full" onClick={() => setImprimiendo(true)}>
              Imprimir / descargar PDF
            </Button>
            {puedeEditar && (
              <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/remisiones/${id}/editar`)}>
                Editar
              </Button>
            )}
            {puedeEditar && (
              <Button type="button" className="w-full" disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate('ENTREGADA')}>
                Marcar entregada
              </Button>
            )}
            {puedeConvertirOAnular && (
              <Button type="button" className="w-full" onClick={() => setConvirtiendo(true)}>
                Convertir en factura
              </Button>
            )}
            {puedeConvertirOAnular && (
              <Button type="button" variante="peligro" className="w-full" disabled={cambiarEstado.isPending} onClick={() => cambiarEstado.mutate('ANULADA')}>
                Anular
              </Button>
            )}
          </>
        }
      >
        {!remision ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : (
          <>
            {remision.observaciones && (
              <Card titulo="Observaciones">
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{remision.observaciones}</p>
              </Card>
            )}
            <TablaArticulosDocumento lineas={remision.lineas} mostrarPrecios={false} />
          </>
        )}
      </PaginaDocumento>

      {imprimiendo && remision && (
        <ModalImprimir urlBase={`/remisiones/${remision.id}`} titulo={`Imprimir — ${remision.numero}`} onClose={() => setImprimiendo(false)} />
      )}
      {convirtiendo && remision && <ModalConvertirRemision remision={remision} onClose={() => setConvirtiendo(false)} />}
    </RequierePermiso>
  );
}
