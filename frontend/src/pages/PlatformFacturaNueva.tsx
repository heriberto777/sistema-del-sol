import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { platformApiClient } from '../lib/platform-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

interface Tenant {
  id: string;
  nombre: string;
}

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalNuevaFacturaManual de PlatformFacturas.tsx. */
export function PlatformFacturaNueva() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tenantId, setTenantId] = useState('');
  const [lineas, setLineas] = useState<{ concepto: string; monto: string }[]>([{ concepto: '', monto: '' }]);
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ['platform-tenants-lite'],
    queryFn: async () => (await platformApiClient.get<Tenant[]>('/platform/tenants')).data,
  });

  function actualizarLinea(i: number, cambios: Partial<{ concepto: string; monto: string }>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { concepto: '', monto: '' }]);
  }

  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  const crear = useMutation({
    mutationFn: async () =>
      platformApiClient.post('/platform/facturas', {
        tenantId,
        lineas: lineas.map((l) => ({ concepto: l.concepto, monto: Number(l.monto) })),
        fechaVencimiento: fechaVencimiento || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-facturas'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de crear bien.
      confirmarGuardado();
      setTimeout(() => navigate('/plataforma/facturas'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la factura — revisa el tenant y los montos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ tenantId, lineas, fechaVencimiento });

  return (
    <PaginaDocumento
      titulo="Nueva factura manual"
      rutaVolver="/plataforma/facturas"
      etiquetaVolver="Volver a Facturas"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            RD$ {lineas.reduce((acc, l) => acc + (Number(l.monto) || 0), 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nueva-factura-plataforma" disabled={crear.isPending || !tenantId} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear factura'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/plataforma/facturas')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-factura-plataforma" onSubmit={onSubmit} className="space-y-3">
        <Card titulo="Información de la factura">
          <div className="sm:col-span-2">
            <label htmlFor="nueva-factura-tenant" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tenant
            </label>
            <Select id="nueva-factura-tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required>
              <option value="" disabled>
                Selecciona un tenant
              </option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
            {lineas.map((linea, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <FormField
                    id={`linea-concepto-${i}`}
                    label="Concepto"
                    value={linea.concepto}
                    onChange={(e) => actualizarLinea(i, { concepto: e.target.value })}
                    required
                  />
                </div>
                <div className="w-32">
                  <FormField
                    id={`linea-monto-${i}`}
                    label="Monto"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={linea.monto}
                    onChange={(e) => actualizarLinea(i, { monto: e.target.value })}
                    required
                  />
                </div>
                {lineas.length > 1 && (
                  <Button type="button" variante="peligro" onClick={() => quitarLinea(i)}>
                    ×
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variante="secundario" onClick={agregarLinea}>
              Agregar línea
            </Button>
          </div>

          <FormField
            id="nueva-factura-vencimiento"
            label="Fecha de vencimiento (opcional)"
            type="date"
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
          />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
