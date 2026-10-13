import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { UsuarioBasico } from '../../../types/crm';

const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function ModalFormMetaVenta({ anio, mes, onClose }: { anio: number; mes: number; onClose: () => void }) {
  const queryClient = useQueryClient();
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
      onClose();
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

  return (
    <Modal titulo={`Meta de venta — ${NOMBRES_MES[mes - 1]} ${anio}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-col gap-1">
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
