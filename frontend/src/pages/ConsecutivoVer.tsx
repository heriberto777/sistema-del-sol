import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

type TipoCorrelativo = 'COTIZACION' | 'REMISION' | 'ORDEN_COMPRA' | 'CAJA' | 'PRODUCTO' | 'CUENTA_CONTABLE' | 'FACTURA' | 'AJUSTE' | 'TRANSFERENCIA';

interface Correlativo {
  id: string | null;
  tipo: TipoCorrelativo;
  prefijo: string;
  siguienteNumero: number;
  digitos: number;
}

const ETIQUETA_TIPO: Record<TipoCorrelativo, string> = {
  COTIZACION: 'Cotizaciones',
  REMISION: 'Remisiones',
  ORDEN_COMPRA: 'Órdenes de compra',
  CAJA: 'Cajas',
  PRODUCTO: 'Productos (botón "Asignar")',
  CUENTA_CONTABLE: 'Cuentas contables (botón "Asignar")',
  FACTURA: 'Facturación',
  AJUSTE: 'Ajustes de inventario',
  TRANSFERENCIA: 'Transferencias de inventario',
};

/** Auditoría de modales pendientes (bloque "Chicos") — reemplaza al modal "Editar consecutivo" de CorrelativosPanel.tsx. */
export function ConsecutivoVer() {
  const { tipo } = useParams<{ tipo: TipoCorrelativo }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [prefijo, setPrefijo] = useState('');
  const [siguienteNumero, setSiguienteNumero] = useState('');
  const [digitos, setDigitos] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  const { data: correlativos } = useQuery({
    queryKey: ['admin-correlativos'],
    queryFn: async () => (await apiClient.get<Correlativo[]>('/admin/correlativos')).data,
  });
  const correlativo = correlativos?.find((c) => c.tipo === tipo);

  useEffect(() => {
    if (correlativo && !cargado) {
      setPrefijo(correlativo.prefijo);
      setSiguienteNumero(String(correlativo.siguienteNumero));
      setDigitos(String(correlativo.digitos));
      setCargado(true);
    }
  }, [correlativo, cargado]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/admin/correlativos/${tipo}`, {
        prefijo,
        siguienteNumero: Number(siguienteNumero),
        digitos: Number(digitos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-correlativos'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de guardar bien.
      confirmarGuardado();
      setTimeout(() => navigate('/consecutivos'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el consecutivo.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ prefijo, siguienteNumero, digitos }, cargado);

  return (
    <PaginaDocumento
      titulo={tipo ? `Consecutivo — ${ETIQUETA_TIPO[tipo]}` : 'Consecutivo'}
      rutaVolver="/consecutivos"
      etiquetaVolver="Volver a Consecutivos"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Ejemplo</span>
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            {prefijo}
            {siguienteNumero.padStart(Number(digitos) || 0, '0')}
          </span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-ver-consecutivo" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/consecutivos')}>
            Volver
          </Button>
        </>
      }
    >
      {!correlativo ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form id="form-ver-consecutivo" onSubmit={onSubmit} className="space-y-3">
          <Card titulo="Información del consecutivo">
            <FormField id="correlativo-prefijo" label="Prefijo (opcional)" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} />
            <FormField
              id="correlativo-siguiente"
              label="Próximo número a asignar (no el último usado)"
              type="number"
              min={1}
              value={siguienteNumero}
              onChange={(e) => setSiguienteNumero(e.target.value)}
              required
            />
            <FormField
              id="correlativo-digitos"
              label="Dígitos (padding con ceros a la izquierda)"
              type="number"
              min={1}
              value={digitos}
              onChange={(e) => setDigitos(e.target.value)}
              required
            />
          </Card>
        </form>
      )}
    </PaginaDocumento>
  );
}
