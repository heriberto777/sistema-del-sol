import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { FormField } from '../../components/molecules/FormField/FormField';
import { useHayCambios } from '../../hooks/useHayCambios';
import { UsuarioBasico } from '../../types/crm';

const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalFormMetaVenta de CrmMetasVentaPanel.tsx. */
export function MetaVentaNueva() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const hoy = new Date();
  const anio = Number(searchParams.get('anio')) || hoy.getFullYear();
  const mes = Number(searchParams.get('mes')) || hoy.getMonth() + 1;
  const [vendedorId, setVendedorId] = useState('');
  const [montoMeta, setMontoMeta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: vendedores } = useQuery({
    queryKey: ['crm-metas-vendedores'],
    queryFn: async () => (await apiClient.get<UsuarioBasico[]>('/crm/metas-venta/vendedores')).data,
  });

  const guardar = useMutation({
    mutationFn: async () => apiClient.post('/crm/metas-venta', { vendedorId, anio, mes, montoMeta: Number(montoMeta) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-metas-venta'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de crear bien.
      confirmarGuardado();
      setTimeout(() => navigate('/crm/metas-venta'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la meta.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vendedorId) {
      setError('Elegí un vendedor.');
      return;
    }
    if (!montoMeta || Number(montoMeta) <= 0) {
      setError('Ingresá un monto mayor a cero.');
      return;
    }
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ vendedorId, montoMeta });

  return (
    <PaginaDocumento
      titulo={`Meta de venta — ${NOMBRES_MES[mes - 1]} ${anio}`}
      rutaVolver="/crm/metas-venta"
      etiquetaVolver="Volver a Metas de venta"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Período</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {NOMBRES_MES[mes - 1]} {anio}
          </span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-meta-venta" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/crm/metas-venta')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-meta-venta" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Información de la meta">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vendedor</label>
            <select
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Seleccionar…</option>
              {vendedores?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </div>
          <FormField id="meta-monto" label="Meta (RD$)" type="number" min={0} step="0.01" value={montoMeta} onChange={(e) => setMontoMeta(e.target.value)} required />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
