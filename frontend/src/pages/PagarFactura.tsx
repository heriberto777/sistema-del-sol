import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { pagosPublicosApiClient } from '../lib/pagos-publicos-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';

type EstadoFactura = 'PENDIENTE' | 'PAGADA' | 'VENCIDA' | 'ANULADA';

interface FacturaPublica {
  tenant: { nombre: string };
  concepto: string;
  total: string;
  pendiente: number;
  estado: EstadoFactura;
  fechaVencimiento: string;
}

const TONO_POR_ESTADO: Record<EstadoFactura, 'exito' | 'advertencia' | 'peligro' | 'neutro'> = {
  PENDIENTE: 'neutro',
  PAGADA: 'exito',
  VENCIDA: 'peligro',
  ANULADA: 'advertencia',
};

export function PagarFactura() {
  const { facturaId } = useParams<{ facturaId: string }>();
  const [error, setError] = useState<string | null>(null);

  const { data: factura, isLoading, isError } = useQuery({
    queryKey: ['factura-publica', facturaId],
    queryFn: async () => (await pagosPublicosApiClient.get<FacturaPublica>(`/pagos-publicos/facturas/${facturaId}`)).data,
  });

  const pagar = useMutation({
    mutationFn: async () => (await pagosPublicosApiClient.post<{ url: string }>(`/pagos-publicos/facturas/${facturaId}/checkout`)).data,
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo iniciar el pago en línea. Intenta de nuevo en unos minutos.')),
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-sol-600 dark:text-sol-400">El Sistema del Sol</h1>

        {isLoading && <p className="text-sm text-slate-400">Cargando…</p>}
        {isError && <p className="text-sm text-red-600">No encontramos esa factura.</p>}

        {factura && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{factura.tenant.nombre}</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{factura.concepto}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
              <p>Total: RD$ {Number(factura.total).toLocaleString('es-DO')}</p>
              <p>Pendiente: RD$ {factura.pendiente.toLocaleString('es-DO')}</p>
              <p className="mt-1">
                Estado: <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.estado}</Badge>
              </p>
            </div>

            {factura.estado === 'PAGADA' && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Esta factura ya fue pagada — gracias.</p>
            )}
            {factura.estado === 'ANULADA' && <p className="text-sm text-slate-400">Esta factura fue anulada.</p>}
            {(factura.estado === 'PENDIENTE' || factura.estado === 'VENCIDA') && (
              <>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button className="w-full" disabled={pagar.isPending} onClick={() => pagar.mutate()}>
                  {pagar.isPending ? 'Redirigiendo…' : 'Pagar con tarjeta'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
