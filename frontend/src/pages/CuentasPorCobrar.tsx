import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Wallet } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { StatCard } from '../components/molecules/StatCard/StatCard';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { ModalRegistrarCobro } from '../components/molecules/ModalRegistrarCobro/ModalRegistrarCobro';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

type Bucket = 'CORRIENTE' | 'D1_30' | 'D31_60' | 'D61_90' | 'D90_MAS';

interface FilaCxC {
  id: string;
  numero: string | null;
  ncf: string | null;
  cliente: string;
  fecha: string;
  vencimiento: string;
  total: number;
  pagado: number;
  pendiente: number;
  diasVencido: number;
  bucket: Bucket;
}

interface Resumen {
  totalCxC: number;
  totalVencido: number;
  totalPorVencer: number;
  buckets: Record<Bucket, number>;
}

const ETIQUETA_BUCKET: Record<Bucket, string> = {
  CORRIENTE: 'Corriente',
  D1_30: '1-30 días',
  D31_60: '31-60 días',
  D61_90: '61-90 días',
  D90_MAS: '+90 días',
};

const TONO_BUCKET: Record<Bucket, 'exito' | 'advertencia' | 'peligro'> = {
  CORRIENTE: 'exito',
  D1_30: 'advertencia',
  D31_60: 'advertencia',
  D61_90: 'peligro',
  D90_MAS: 'peligro',
};

const fmtRD = (v: number) => `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

/**
 * Ítem Cobranza — solo facturas CRÉDITO pendientes (CONTADO se cobra al
 * crear, ver ítem "captura de forma de pago"). Alcance confirmado con el
 * usuario: listado + antigüedad, cobro factura por factura (reusa
 * ModalRegistrarCobro, sin "abono general"/FIFO multi-factura como
 * Cuadre).
 */
export function CuentasPorCobrar() {
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);
  const [facturaCobrando, setFacturaCobrando] = useState<FilaCxC | null>(null);

  const { data: resumen, isLoading: cargandoResumen } = useQuery({
    queryKey: ['cuentas-por-cobrar-resumen'],
    queryFn: async () => (await apiClient.get<Resumen>('/cuentas-por-cobrar/resumen')).data,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['cuentas-por-cobrar', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<FilaCxC>>('/cuentas-por-cobrar', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Cuentas por cobrar</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Facturas a crédito pendientes de cobro, por antigüedad.</p>
      </div>

      <RequierePermiso permiso="cuentasporcobrar.ver">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard etiqueta="Total por cobrar" valor={cargandoResumen ? '…' : fmtRD(resumen?.totalCxC ?? 0)} icono={Wallet} />
          <StatCard etiqueta="Vencido" valor={cargandoResumen ? '…' : fmtRD(resumen?.totalVencido ?? 0)} icono={AlertTriangle} />
          <StatCard etiqueta="Por vencer" valor={cargandoResumen ? '…' : fmtRD(resumen?.totalPorVencer ?? 0)} icono={CalendarClock} />
        </div>

        {error && <p className="text-sm text-red-600">No se pudo cargar Cuentas por cobrar.</p>}

        <Card
          sinPadding
          titulo="Facturas pendientes"
          descripcion={data ? `${data.total} factura(s)` : undefined}
          acciones={
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por número o cliente…"
            />
          }
        >
          {isLoading && <p className="p-5 text-sm text-slate-500">Cargando…</p>}
          {data && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Número</th>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Vencimiento</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Pendiente</th>
                    <th className="px-5 py-3 font-medium">Antigüedad</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.datos.map((fila) => (
                    <tr key={fila.id}>
                      <td className="px-5 py-3 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                        {fila.numero ?? fila.ncf ?? fila.id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-3">{fila.cliente}</td>
                      <td className="px-5 py-3">{new Date(fila.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3">{new Date(fila.vencimiento).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{fmtRD(fila.total)}</td>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{fmtRD(fila.pendiente)}</td>
                      <td className="px-5 py-3">
                        <Badge tono={TONO_BUCKET[fila.bucket]}>{ETIQUETA_BUCKET[fila.bucket]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button variante="secundario" onClick={() => setFacturaCobrando(fila)}>
                          Registrar cobro
                        </Button>
                      </td>
                    </tr>
                  ))}
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

      {facturaCobrando && (
        <ModalRegistrarCobro
          factura={{ id: facturaCobrando.id, numero: facturaCobrando.numero, ncf: facturaCobrando.ncf, total: String(facturaCobrando.total) }}
          onClose={() => setFacturaCobrando(null)}
        />
      )}
    </div>
  );
}
