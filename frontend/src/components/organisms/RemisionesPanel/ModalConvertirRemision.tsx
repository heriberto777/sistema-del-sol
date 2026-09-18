import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Modal } from '../../molecules/Modal/Modal';
import { Select } from '../../atoms/Select/Select';
import { SelectFormaPago } from '../../molecules/SelectFormaPago/SelectFormaPago';
import { Button } from '../../atoms/Button/Button';
import { Remision } from './RemisionesPanel';

export function ModalConvertirRemision({ remision, onClose }: { remision: Remision; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tipoFactura, setTipoFactura] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [formaPagoId, setFormaPagoId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const convertir = useMutation({
    mutationFn: async () =>
      apiClient.post(`/remisiones/${remision.id}/convertir`, {
        tipoFactura,
        formaPagoId: tipoFactura === 'CONTADO' ? formaPagoId || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remisiones'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo convertir la remisión en factura.')),
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
    <Modal titulo={`Convertir en factura — ${remision.numero}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
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
