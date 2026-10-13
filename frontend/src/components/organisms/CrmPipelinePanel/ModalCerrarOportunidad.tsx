import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { Button } from '../../atoms/Button/Button';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Oportunidad } from '../../../types/crm';

export function ModalCerrarOportunidad({ oportunidad, estado, onClose }: { oportunidad: Oportunidad; estado: 'GANADA' | 'PERDIDA'; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [motivoPerdida, setMotivoPerdida] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cerrar = useMutation({
    mutationFn: async () => apiClient.patch(`/crm/oportunidades/${oportunidad.id}/cerrar`, { estado, motivoPerdida: motivoPerdida || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cerrar la oportunidad.')),
  });

  function confirmar() {
    setError(null);
    if (estado === 'PERDIDA' && motivoPerdida.trim().length < 3) {
      setError('Indicá un motivo.');
      return;
    }
    cerrar.mutate();
  }

  return (
    <Modal titulo={estado === 'GANADA' ? `Marcar ganada — ${oportunidad.titulo}` : `Marcar perdida — ${oportunidad.titulo}`} onClose={onClose}>
      <div className="space-y-4">
        {estado === 'GANADA' ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Esta oportunidad queda cerrada como ganada. Generar la cotización real a partir de acá llega en la Fase 2 — por ahora solo marca el desenlace en el pipeline.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Motivo</label>
            <textarea
              value={motivoPerdida}
              onChange={(e) => setMotivoPerdida(e.target.value)}
              placeholder="ej. Precio, eligió a la competencia, se enfrió…"
              rows={2}
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-2 focus:ring-sol-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variante={estado === 'PERDIDA' ? 'peligro' : 'primario'} disabled={cerrar.isPending} onClick={confirmar}>
            {cerrar.isPending ? 'Guardando…' : estado === 'GANADA' ? 'Confirmar ganada' : 'Confirmar perdida'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
