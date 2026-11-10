import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { ConfirmModal } from '../../molecules/ConfirmModal/ConfirmModal';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
}

interface LineaAsiento {
  id: string;
  debito: string;
  credito: string;
  descripcion: string | null;
  cuentaContable: CuentaContable;
}

type OrigenAsiento = 'FACTURA' | 'COMPRA' | 'MANUAL' | 'NOMINA' | 'PAGO' | 'GASTO' | 'GASTO_MENOR' | 'CIERRE' | 'ANULACION';

const ORIGENES_ANULABLES: OrigenAsiento[] = ['MANUAL', 'GASTO'];

interface AsientoContable {
  id: string;
  numero: number;
  fecha: string;
  concepto: string;
  origen: OrigenAsiento;
  anulado: boolean;
  lineas: LineaAsiento[];
}

export function AsientosContablesTable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [asientoAAnular, setAsientoAAnular] = useState<AsientoContable | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['contabilidad-asientos', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<AsientoContable>>('/contabilidad/asientos', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const anular = useMutation({
    mutationFn: async (asientoId: string) => apiClient.post(`/contabilidad/asientos/${asientoId}/anular`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-asientos'] });
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo anular el asiento.')),
  });

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card
        sinPadding
        titulo="Asientos"
        descripcion={data ? `${data.total} asiento(s)` : undefined}
        acciones={
          <div className="flex items-center gap-2">
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por concepto…"
            />
            {tienePermiso('contabilidad.editar') && <Button onClick={() => navigate('/contabilidad/asientos/nuevo')}>Nuevo asiento</Button>}
          </div>
        }
      >
        {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando asientos…</p>}
        {errorCarga && <p className="p-5 text-sm text-red-600">No se pudieron cargar los asientos.</p>}

        {data && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.datos.map((asiento) => (
              <div key={asiento.id} className="p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                    #{asiento.numero} — {asiento.concepto}
                    {asiento.anulado && <Badge tono="peligro">Anulado</Badge>}
                  </span>
                  <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    {asiento.origen} · {new Date(asiento.fecha).toLocaleDateString('es-DO')}
                    {!asiento.anulado && ORIGENES_ANULABLES.includes(asiento.origen) && tienePermiso('contabilidad.anular') && (
                      <Button type="button" variante="peligro" disabled={anular.isPending} onClick={() => setAsientoAAnular(asiento)}>
                        Anular
                      </Button>
                    )}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="mt-2 w-full text-left text-xs">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {asiento.lineas.map((linea) => (
                        <tr key={linea.id}>
                          <td className="py-1 text-slate-600 dark:text-slate-400">
                            {linea.cuentaContable.codigo} — {linea.cuentaContable.nombre}
                          </td>
                          <td className="py-1 text-right text-slate-600 dark:text-slate-400">{Number(linea.debito) > 0 ? `RD$ ${Number(linea.debito).toLocaleString('es-DO')}` : ''}</td>
                          <td className="py-1 text-right text-slate-600 dark:text-slate-400">{Number(linea.credito) > 0 ? `RD$ ${Number(linea.credito).toLocaleString('es-DO')}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
        {data && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>

      {asientoAAnular && (
        <ConfirmModal
          titulo="¿Anular este asiento?"
          descripcion={
            <>
              Se anulará el asiento <b>#{asientoAAnular.numero} — {asientoAAnular.concepto}</b> y se generará un reverso.
            </>
          }
          confirmarTexto="Anular"
          confirmando={anular.isPending}
          onConfirmar={() => {
            anular.mutate(asientoAAnular.id);
            setAsientoAAnular(null);
          }}
          onCancelar={() => setAsientoAAnular(null)}
        />
      )}
    </div>
  );
}
