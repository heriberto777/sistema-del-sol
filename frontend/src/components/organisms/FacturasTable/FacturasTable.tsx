import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { ModalImprimir } from '../../molecules/ModalImprimir/ModalImprimir';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';
import { ModalRegistrarCobro } from '../../molecules/ModalRegistrarCobro/ModalRegistrarCobro';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { Factura, TONO_POR_ESTADO, identificadorFactura, ModalAnularFactura, ModalLinkPago } from './factura-compartido';

interface FacturasTableProps {
  /** Filtra por tipo (ej. ['NOTA_CREDITO', 'NOTA_DEBITO']) — usado por la pantalla de Notas (Fase 4a). Sin esto, trae todos los tipos. */
  tiposFactura?: Factura['tipoFactura'][];
  titulo?: string;
  busquedaPlaceholder?: string;
}

/**
 * Auditoría UX (post Período Contable, 2026-11) — "Ver detalle" pasó de
 * modal (`ModalDetalleFactura`) a página propia (`FacturacionVer`,
 * `/facturacion/:id`), con más información y los botones de acción en el
 * panel lateral siempre visible. Esta tabla solo navega — las acciones
 * rápidas por fila (Anular/Registrar cobro/Generar link) se quedan como
 * modal, reusando `factura-compartido.tsx` (mismo componente que importa
 * `FacturacionVer`).
 */
export function FacturasTable({ tiposFactura, titulo = 'Facturas', busquedaPlaceholder = 'Buscar por NCF o cliente…' }: FacturasTableProps = {}) {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [facturaCobrando, setFacturaCobrando] = useState<Factura | null>(null);
  const [facturaAnulando, setFacturaAnulando] = useState<Factura | null>(null);
  const [facturaImprimiendo, setFacturaImprimiendo] = useState<Factura | null>(null);
  const [facturaLinkPago, setFacturaLinkPago] = useState<Factura | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['facturas', pagina, busquedaDebounced, tiposFactura],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Factura>>('/facturas', {
          params: { pagina, busqueda: busquedaDebounced || undefined, tipoFactura: tiposFactura },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">No se pudieron cargar las facturas.</p>}

      <Card
        sinPadding
        titulo={titulo}
        descripcion={data ? `${data.total} factura(s)` : undefined}
        acciones={
          <SearchInput
            value={busqueda}
            onChange={(v) => {
              setBusqueda(v);
              setPagina(1);
            }}
            placeholder={busquedaPlaceholder}
          />
        }
      >
        {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando facturas…</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Número</th>
                  <th className="px-5 py-3 font-medium">NCF</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.datos.map((factura) => {
                  const acciones = [
                    { etiqueta: 'Imprimir', onClick: () => setFacturaImprimiendo(factura) },
                    ...(factura.tipoFactura === 'CREDITO' &&
                    factura.estado === 'EMITIDA' &&
                    !factura.pagada &&
                    tienePermiso('facturacion.cobrar')
                      ? [
                          { etiqueta: 'Registrar cobro', onClick: () => setFacturaCobrando(factura) },
                          { etiqueta: 'Generar link de pago', onClick: () => setFacturaLinkPago(factura) },
                        ]
                      : []),
                    ...(factura.estado === 'EMITIDA' && tienePermiso('facturacion.anular')
                      ? [{ etiqueta: 'Anular', onClick: () => setFacturaAnulando(factura), tono: 'peligro' as const }]
                      : []),
                  ];

                  return (
                    <tr
                      key={factura.id}
                      onClick={() => navigate(`/facturacion/${factura.id}`)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                        {identificadorFactura(factura)}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{factura.ncf ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{factura.cliente?.nombre}</td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{factura.tipoFactura}</td>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">RD$ {Number(factura.total).toLocaleString('es-DO')}</td>
                      <td className="px-5 py-3">
                        <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.estado}</Badge>
                        {factura.tieneNotaAplicada && (
                          <span className="ml-2 inline-block">
                            <Badge tono="advertencia">Nota aplicada</Badge>
                          </span>
                        )}
                        {factura.tipoFactura === 'CREDITO' && factura.estado === 'EMITIDA' && (
                          <span className="ml-2 text-xs text-slate-400">{factura.pagada ? 'pagada' : 'pendiente de cobro'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{new Date(factura.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/facturacion/${factura.id}`)}
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
        )}
        {data && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>

      {facturaCobrando && <ModalRegistrarCobro factura={facturaCobrando} onClose={() => setFacturaCobrando(null)} />}
      {facturaAnulando && <ModalAnularFactura factura={facturaAnulando} onClose={() => setFacturaAnulando(null)} />}
      {facturaLinkPago && <ModalLinkPago factura={facturaLinkPago} onClose={() => setFacturaLinkPago(null)} />}
      {facturaImprimiendo && (
        <ModalImprimir
          urlBase={`/facturas/${facturaImprimiendo.id}`}
          titulo={`Imprimir — ${identificadorFactura(facturaImprimiendo)}`}
          onClose={() => setFacturaImprimiendo(null)}
        />
      )}
    </div>
  );
}
