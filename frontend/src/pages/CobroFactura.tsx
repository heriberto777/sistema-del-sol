import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { cobrosPublicosApiClient } from '../lib/cobros-publicos-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';

type EstadoFactura = 'BORRADOR' | 'EMITIDA' | 'ANULADA';

interface FacturaPublica {
  tenantNombre: string;
  numero: string;
  total: string;
  pendiente: number;
  estado: EstadoFactura;
  pagada: boolean;
  pasarelaDisponible: 'AZUL' | 'CARDNET' | null;
}

interface ResultadoCheckout {
  metodo: 'GET' | 'POST';
  url: string;
  campos?: Record<string, string>;
}

const TONO_POR_ESTADO: Record<EstadoFactura, 'exito' | 'advertencia' | 'peligro' | 'neutro'> = {
  EMITIDA: 'neutro',
  BORRADOR: 'advertencia',
  ANULADA: 'peligro',
};

/**
 * Link público de pago de una Factura de TENANT (ítem C-1, Payment Link)
 * — distinto de `/pagar/:facturaId` (esa es la pasarela de PLATAFORMA
 * cobrándole al tenant). El cliente elige cuánto pagar (hasta el
 * pendiente completo, decisión confirmada con el usuario) y el checkout
 * puede resolver en un simple redirect (CardNet) o en un <form> POST
 * autoenviado con campos firmados (AZUL) — `metodo`/`campos` deciden cuál.
 */
export function CobroFactura() {
  const { facturaId } = useParams<{ facturaId: string }>();
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [formPost, setFormPost] = useState<{ url: string; campos: Record<string, string> } | null>(null);

  const { data: factura, isLoading, isError } = useQuery({
    queryKey: ['factura-cobro-publica', facturaId],
    queryFn: async () => (await cobrosPublicosApiClient.get<FacturaPublica>(`/cobros-publicos/facturas/${facturaId}`)).data,
  });

  useEffect(() => {
    if (factura && monto === '') setMonto(factura.pendiente.toFixed(2));
  }, [factura, monto]);

  const pagar = useMutation({
    mutationFn: async () =>
      (await cobrosPublicosApiClient.post<ResultadoCheckout>(`/cobros-publicos/facturas/${facturaId}/checkout`, { monto: Number(monto) })).data,
    onSuccess: (resultado) => {
      if (resultado.metodo === 'GET') {
        window.location.href = resultado.url;
      } else {
        setFormPost({ url: resultado.url, campos: resultado.campos ?? {} });
      }
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo iniciar el pago en línea. Intenta de nuevo en unos minutos.')),
  });

  useEffect(() => {
    if (formPost) formRef.current?.submit();
  }, [formPost]);

  function onSubmit() {
    setError(null);
    const montoNumero = Number(monto);
    if (!factura || Number.isNaN(montoNumero) || montoNumero <= 0) {
      setError('Ingresá un monto válido.');
      return;
    }
    if (montoNumero > factura.pendiente + 0.005) {
      setError(`El monto no puede superar el pendiente (RD$ ${factura.pendiente.toLocaleString('es-DO')}).`);
      return;
    }
    pagar.mutate();
  }

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
              <p className="text-sm text-slate-500 dark:text-slate-400">{factura.tenantNombre}</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">Factura {factura.numero}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
              <p>Total: RD$ {Number(factura.total).toLocaleString('es-DO')}</p>
              <p>Pendiente: RD$ {factura.pendiente.toLocaleString('es-DO')}</p>
              <p className="mt-1">
                Estado: <Badge tono={TONO_POR_ESTADO[factura.estado]}>{factura.pagada ? 'PAGADA' : factura.estado}</Badge>
              </p>
            </div>

            {factura.pagada && <p className="text-sm text-emerald-600 dark:text-emerald-400">Esta factura ya fue pagada — gracias.</p>}
            {factura.estado === 'ANULADA' && <p className="text-sm text-slate-400">Esta factura fue anulada.</p>}
            {!factura.pagada && factura.estado === 'EMITIDA' && !factura.pasarelaDisponible && (
              <p className="text-sm text-amber-600 dark:text-amber-400">Este negocio no tiene un pago en línea disponible todavía.</p>
            )}

            {!factura.pagada && factura.estado === 'EMITIDA' && factura.pasarelaDisponible && (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="cobro-monto" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Monto a pagar
                  </label>
                  <input
                    id="cobro-monto"
                    type="number"
                    min={0.01}
                    max={factura.pendiente}
                    step="0.01"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button className="w-full" disabled={pagar.isPending} onClick={onSubmit}>
                  {pagar.isPending ? 'Redirigiendo…' : 'Pagar con tarjeta'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {formPost && (
        <form ref={formRef} method="POST" action={formPost.url} className="hidden">
          {Object.entries(formPost.campos).map(([nombre, valor]) => (
            <input key={nombre} type="hidden" name={nombre} value={valor} />
          ))}
        </form>
      )}
    </div>
  );
}
