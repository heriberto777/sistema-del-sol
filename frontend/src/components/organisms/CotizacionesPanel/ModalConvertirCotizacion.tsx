import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { Select } from '../../atoms/Select/Select';
import { SelectFormaPago } from '../../molecules/SelectFormaPago/SelectFormaPago';
import { Button } from '../../atoms/Button/Button';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import type { BodegaBasica } from '@backend-src/common/prisma/bodega-select-basico';
import { Cotizacion } from './CotizacionesPanel';

// Exclusivo de este modal — ningún otro archivo de CotizacionesPanel necesita Bodega.
type Bodega = BodegaBasica;

export function ModalConvertirCotizacion({ cotizacion, onClose }: { cotizacion: Cotizacion; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [bodegaId, setBodegaId] = useState('');
  const [tipoFactura, setTipoFactura] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [formaPagoId, setFormaPagoId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const convertir = useMutation({
    mutationFn: async () =>
      apiClient.post(`/cotizaciones/${cotizacion.id}/convertir`, {
        bodegaId,
        tipoFactura,
        formaPagoId: tipoFactura === 'CONTADO' ? formaPagoId || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo convertir la cotización en factura.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (tipoFactura === 'CONTADO' && !formaPagoId) {
      setError('Seleccioná la forma de pago.');
      return;
    }
    convertir.mutate();
  }

  return (
    <Modal titulo={`Convertir en factura — ${cotizacion.numero}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega (de donde sale el inventario)</label>
          <Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {bodegas?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Opción de pago</label>
          <Select value={tipoFactura} onChange={(e) => setTipoFactura(e.target.value as 'CONTADO' | 'CREDITO')}>
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </Select>
        </div>
        {tipoFactura === 'CONTADO' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Forma de pago</label>
            <SelectFormaPago value={formaPagoId} onChange={setFormaPagoId} />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={convertir.isPending} className="w-full">
          {convertir.isPending ? 'Convirtiendo…' : 'Convertir en factura'}
        </Button>
      </form>
    </Modal>
  );
}
