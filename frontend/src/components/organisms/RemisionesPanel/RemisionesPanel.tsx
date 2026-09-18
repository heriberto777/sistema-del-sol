import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import type { ClienteBasico } from '@backend-src/common/prisma/cliente-select-basico';
import type { BodegaBasica } from '@backend-src/common/prisma/bodega-select-basico';
import { ModalImprimir } from '../../molecules/ModalImprimir/ModalImprimir';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Badge } from '../../atoms/Badge/Badge';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { ModalDetalleRemision } from './ModalDetalleRemision';
import { ModalNuevaRemision } from './ModalNuevaRemision';
import { ModalEditarRemision } from './ModalEditarRemision';
import { ModalConvertirRemision } from './ModalConvertirRemision';

// Solo id/nombre — es lo único que los modales de este panel leen de
// Cliente (combobox de búsqueda + preselección al editar). `ClienteBasico`
// sigue siendo la fuente real; acotarlo acá con Pick evita forzar campos
// que nunca se usan. Exportado — lo comparten los modales extraídos a su
// propio archivo (auditoría de estructura, mismo criterio que
// ModalRegistrarCobro/ModalRegistrarPagoOrdenCompra).
export type Cliente = Pick<ClienteBasico, 'id' | 'nombre'>;

export interface Producto {
  id: string;
  nombre: string;
  codigo: string;
}

export type Bodega = BodegaBasica;

export type EstadoRemision = 'BORRADOR' | 'ENTREGADA' | 'FACTURADA' | 'ANULADA';

export interface Remision {
  id: string;
  numero: string;
  estado: EstadoRemision;
  facturaId: string | null;
  clienteId: string;
  bodegaId: string;
  cliente: ClienteBasico;
  lineas: { productoId: string; varianteId: string; cantidad: string }[];
}

export interface RemisionDetalle extends Omit<Remision, 'lineas'> {
  fecha: string;
  bodega: { nombre: string };
  lineas: { producto: { nombre: string } | null; cantidad: string }[];
}

export const TONO_POR_ESTADO: Record<EstadoRemision, 'exito' | 'advertencia' | 'peligro' | 'neutro'> = {
  BORRADOR: 'neutro',
  ENTREGADA: 'advertencia',
  FACTURADA: 'exito',
  ANULADA: 'peligro',
};

export type LineaForm = { productoId: string; varianteId: string; cantidad: string };

export function RemisionesPanel() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [modalNuevaRemision, setModalNuevaRemision] = useState(false);

  const [remisionEditando, setRemisionEditando] = useState<Remision | null>(null);
  const [remisionConvirtiendo, setRemisionConvirtiendo] = useState<Remision | null>(null);
  const [remisionImprimiendo, setRemisionImprimiendo] = useState<Remision | null>(null);
  const [remisionViendo, setRemisionViendo] = useState<Remision | null>(null);

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const { data } = useQuery({
    queryKey: ['remisiones', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Remision>>('/remisiones', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'ENTREGADA' | 'ANULADA' }) =>
      apiClient.patch(`/remisiones/${id}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remisiones'] }),
  });

  return (
    <div className="space-y-4">
      <Card
        sinPadding
        titulo="Remisiones"
        descripcion={data ? `${data.total} remisión(es) — el inventario se descuenta al marcar "Entregada", no al crear` : undefined}
        acciones={
          <div className="flex items-center gap-2">
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por número o cliente…"
            />
            {tienePermiso('remisiones.crear') && <Button onClick={() => setModalNuevaRemision(true)}>Nueva remisión</Button>}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Número</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.datos.map((remision) => {
                const acciones = [
                  { etiqueta: 'Imprimir', onClick: () => setRemisionImprimiendo(remision) },
                  ...(tienePermiso('remisiones.editar') && remision.estado === 'BORRADOR'
                    ? [{ etiqueta: 'Editar', onClick: () => setRemisionEditando(remision) }]
                    : []),
                  ...(tienePermiso('remisiones.editar') && remision.estado === 'BORRADOR'
                    ? [{ etiqueta: 'Marcar entregada', onClick: () => cambiarEstado.mutate({ id: remision.id, estado: 'ENTREGADA' }) }]
                    : []),
                  ...(tienePermiso('remisiones.editar') && (remision.estado === 'BORRADOR' || remision.estado === 'ENTREGADA')
                    ? [
                        { etiqueta: 'Convertir en factura', onClick: () => setRemisionConvirtiendo(remision) },
                        { etiqueta: 'Anular', onClick: () => cambiarEstado.mutate({ id: remision.id, estado: 'ANULADA' }), tono: 'peligro' as const },
                      ]
                    : []),
                ];

                return (
                  <tr
                    key={remision.id}
                    onClick={() => setRemisionViendo(remision)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{remision.numero}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{remision.cliente?.nombre}</td>
                    <td className="px-5 py-3">
                      <Badge tono={TONO_POR_ESTADO[remision.estado]}>{remision.estado}</Badge>
                      {remision.facturaId && <span className="ml-2 text-xs text-slate-400">Ya facturada</span>}
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setRemisionViendo(remision)}
                          className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          aria-label="Ver detalle"
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </button>
                        {acciones.length > 0 && <RowActionsMenu acciones={acciones} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>

      {modalNuevaRemision && (
        <ModalNuevaRemision productos={productos ?? []} bodegas={bodegas ?? []} onClose={() => setModalNuevaRemision(false)} />
      )}

      {remisionEditando && (
        <ModalEditarRemision
          remisionId={remisionEditando.id}
          numeroActual={remisionEditando.numero}
          productos={productos ?? []}
          bodegas={bodegas ?? []}
          onClose={() => setRemisionEditando(null)}
        />
      )}
      {remisionConvirtiendo && (
        <ModalConvertirRemision remision={remisionConvirtiendo} onClose={() => setRemisionConvirtiendo(null)} />
      )}
      {remisionImprimiendo && (
        <ModalImprimir
          urlBase={`/remisiones/${remisionImprimiendo.id}`}
          titulo={`Imprimir — ${remisionImprimiendo.numero}`}
          onClose={() => setRemisionImprimiendo(null)}
        />
      )}
      {remisionViendo && (
        <ModalDetalleRemision
          remision={remisionViendo}
          onClose={() => setRemisionViendo(null)}
          onImprimir={() => {
            setRemisionImprimiendo(remisionViendo);
            setRemisionViendo(null);
          }}
        />
      )}
    </div>
  );
}
