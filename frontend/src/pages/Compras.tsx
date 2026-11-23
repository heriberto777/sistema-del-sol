import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { ConfirmModal } from '../components/molecules/ConfirmModal/ConfirmModal';
import { ModalRegistrarPagoOrdenCompra } from '../components/molecules/ModalRegistrarPagoOrdenCompra/ModalRegistrarPagoOrdenCompra';
import { ModalImprimir } from '../components/molecules/ModalImprimir/ModalImprimir';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { AvisoPeriodoContable } from '../components/molecules/AvisoPeriodoContable/AvisoPeriodoContable';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface OrdenCompra {
  id: string;
  numero: string;
  estado: string;
  total: string;
  pagada: boolean;
  proveedor: { nombre: string };
}

// 'PENDIENTE' no existe en el enum EstadoOrdenCompra del backend (BORRADOR/
// ENVIADA/RECIBIDA_PARCIAL/RECIBIDA_TOTAL/CANCELADA) — sin este fix ninguna
// orden recién creada (siempre arranca en BORRADOR) podía recibirse nunca
// desde la UI (bug real preexistente, encontrado al verificar Fase 5b).
const ESTADOS_RECIBIBLES = ['BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL'];
const ESTADOS_CON_MERCANCIA_RECIBIDA = ['RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL'];
// Ítem E-1 — activa el flujo Borrador→Confirmado que el enum ya sugería:
// Editar/Confirmar solo tienen sentido en BORRADOR; Cancelar se bloquea en
// el backend si ya hay mercancía recibida (ahí corresponde "Devolver a
// proveedor" en su lugar), así que acá alcanza con excluir los 3 estados
// terminales/ya-recibidos.
const ESTADOS_CANCELABLES = ['BORRADOR', 'ENVIADA'];

export function Compras() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [ordenPagando, setOrdenPagando] = useState<OrdenCompra | null>(null);
  const [ordenACancelar, setOrdenACancelar] = useState<OrdenCompra | null>(null);
  const [ordenImprimiendo, setOrdenImprimiendo] = useState<OrdenCompra | null>(null);
  const queryClient = useQueryClient();

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'ENVIADA' | 'CANCELADA' }) =>
      apiClient.patch(`/compras/${id}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ordenes-compra'] }),
  });

  const { data } = useQuery({
    queryKey: ['ordenes-compra', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<OrdenCompra>>('/compras', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <AvisoPeriodoContable />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Compras</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Órdenes de compra a tus proveedores.</p>
        </div>
        <RequierePermiso permiso="compras.crear">
          <Button onClick={() => navigate('/compras/nueva')}>Nueva orden de compra</Button>
        </RequierePermiso>
      </div>
      <RequierePermiso permiso="compras.ver">
        <Card
          sinPadding
          titulo="Órdenes de compra"
          descripcion={data ? `${data.total} orden(es)` : undefined}
          acciones={
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por número o proveedor…"
            />
          }
        >
          {data?.datos.length === 0 ? (
            <div className="p-5">
              <EstadoVacio
                titulo="Todavía no hay órdenes de compra"
                descripcion="Creá la primera para empezar a recibir mercancía de tus proveedores."
                etiquetaAccion="Nueva orden de compra"
                onAccion={() => navigate('/compras/nueva')}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Número</th>
                    <th className="px-5 py-3 font-medium">Proveedor</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.datos.map((oc) => {
                    const acciones = [
                      { etiqueta: 'Ver detalle', onClick: () => navigate(`/compras/${oc.id}`) },
                      { etiqueta: 'Imprimir', onClick: () => setOrdenImprimiendo(oc) },
                      ...(oc.estado === 'BORRADOR' && tienePermiso('compras.editar')
                        ? [{ etiqueta: 'Confirmar', onClick: () => cambiarEstado.mutate({ id: oc.id, estado: 'ENVIADA' }) }]
                        : []),
                      ...(ESTADOS_RECIBIBLES.includes(oc.estado) && tienePermiso('compras.recibir')
                        ? [{ etiqueta: 'Recibir', onClick: () => navigate(`/compras/${oc.id}/recibir`) }]
                        : []),
                      ...(oc.estado !== 'CANCELADA' && !oc.pagada && tienePermiso('compras.pagar')
                        ? [{ etiqueta: 'Registrar pago', onClick: () => setOrdenPagando(oc) }]
                        : []),
                      ...(ESTADOS_CON_MERCANCIA_RECIBIDA.includes(oc.estado) && tienePermiso('compras.recibir')
                        ? [{ etiqueta: 'Devolver a proveedor', onClick: () => navigate(`/compras/${oc.id}/devolver`) }]
                        : []),
                      ...(ESTADOS_CANCELABLES.includes(oc.estado) && tienePermiso('compras.editar')
                        ? [
                            {
                              etiqueta: 'Cancelar',
                              tono: 'peligro' as const,
                              onClick: () => setOrdenACancelar(oc),
                            },
                          ]
                        : []),
                    ];

                    return (
                      <tr key={oc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3">{oc.numero}</td>
                        <td className="px-5 py-3">{oc.proveedor?.nombre}</td>
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">RD$ {Number(oc.total).toLocaleString('es-DO')}</td>
                        <td className="px-5 py-3">
                          <Badge>{oc.estado}</Badge>
                          <span className="ml-2 text-xs text-slate-400">{oc.pagada ? 'pagada' : 'pendiente de pago'}</span>
                        </td>
                        <td className="px-5 py-3 text-right">{acciones.length > 0 && <RowActionsMenu acciones={acciones} />}</td>
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
      </RequierePermiso>

      {ordenPagando && <ModalRegistrarPagoOrdenCompra orden={ordenPagando} onClose={() => setOrdenPagando(null)} />}
      {ordenImprimiendo && (
        <ModalImprimir urlBase={`/compras/${ordenImprimiendo.id}`} titulo={`Imprimir — ${ordenImprimiendo.numero}`} onClose={() => setOrdenImprimiendo(null)} />
      )}
      {ordenACancelar && (
        <ConfirmModal
          titulo="¿Cancelar esta orden de compra?"
          descripcion={
            <>
              Se cancelará la orden <b>{ordenACancelar.numero}</b> a <b>{ordenACancelar.proveedor.nombre}</b>.
            </>
          }
          confirmarTexto="Cancelar orden"
          confirmando={cambiarEstado.isPending}
          onConfirmar={() => {
            cambiarEstado.mutate({ id: ordenACancelar.id, estado: 'CANCELADA' });
            setOrdenACancelar(null);
          }}
          onCancelar={() => setOrdenACancelar(null)}
        />
      )}
    </div>
  );
}
