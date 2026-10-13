import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Oportunidad } from '../../../types/crm';

export function ModalCerrarOportunidad({ oportunidad, estado, onClose }: { oportunidad: Oportunidad; estado: 'GANADA' | 'PERDIDA'; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [motivoPerdida, setMotivoPerdida] = useState('');
  const [generarCotizacion, setGenerarCotizacion] = useState(false);
  const [fechaVigencia, setFechaVigencia] = useState('');
  const [tipoClienteNuevo, setTipoClienteNuevo] = useState<'PERSONA_FISICA' | 'PERSONA_JURIDICA'>('PERSONA_FISICA');
  const [rncCedulaClienteNuevo, setRncCedulaClienteNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const esLeadSinCliente = !oportunidad.clienteId;

  const cerrarSinCotizacion = useMutation({
    mutationFn: async () => apiClient.patch(`/crm/oportunidades/${oportunidad.id}/cerrar`, { estado, motivoPerdida: motivoPerdida || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cerrar la oportunidad.')),
  });

  const ganarYCotizar = useMutation({
    mutationFn: async () =>
      apiClient.post(`/crm/oportunidades/${oportunidad.id}/convertir`, {
        fechaVigenciaHastaCotizacion: fechaVigencia,
        ...(esLeadSinCliente ? { tipoClienteNuevo, rncCedulaClienteNuevo: rncCedulaClienteNuevo || undefined } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo generar la cotización.')),
  });

  const guardando = cerrarSinCotizacion.isPending || ganarYCotizar.isPending;

  function confirmar() {
    setError(null);
    if (estado === 'PERDIDA') {
      if (motivoPerdida.trim().length < 3) {
        setError('Indicá un motivo.');
        return;
      }
      cerrarSinCotizacion.mutate();
      return;
    }
    if (generarCotizacion) {
      if (!fechaVigencia) {
        setError('Elegí una fecha de vigencia para la cotización.');
        return;
      }
      ganarYCotizar.mutate();
      return;
    }
    cerrarSinCotizacion.mutate();
  }

  return (
    <Modal titulo={estado === 'GANADA' ? `Marcar ganada — ${oportunidad.titulo}` : `Marcar perdida — ${oportunidad.titulo}`} onClose={onClose}>
      <div className="space-y-4">
        {estado === 'GANADA' ? (
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={generarCotizacion} onChange={(e) => setGenerarCotizacion(e.target.checked)} className="mt-0.5" />
              <span>
                Generar la cotización real ahora mismo
                {esLeadSinCliente && ' — esto también convierte el lead en cliente'}.
              </span>
            </label>

            {generarCotizacion && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <FormField id="op-fecha-vigencia" label="Válida hasta" type="date" value={fechaVigencia} onChange={(e) => setFechaVigencia(e.target.value)} required />
                {esLeadSinCliente && (
                  <div className="flex gap-2">
                    <select
                      value={tipoClienteNuevo}
                      onChange={(e) => setTipoClienteNuevo(e.target.value as 'PERSONA_FISICA' | 'PERSONA_JURIDICA')}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="PERSONA_FISICA">Persona física</option>
                      <option value="PERSONA_JURIDICA">Persona jurídica</option>
                    </select>
                    <input
                      type="text"
                      value={rncCedulaClienteNuevo}
                      onChange={(e) => setRncCedulaClienteNuevo(e.target.value)}
                      placeholder="RNC/Cédula (opcional)"
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>
            )}

            {!generarCotizacion && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Sin tildar la opción, la oportunidad solo queda marcada como ganada en el pipeline, sin generar ningún documento.</p>
            )}
          </div>
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
          <Button type="button" variante={estado === 'PERDIDA' ? 'peligro' : 'primario'} disabled={guardando} onClick={confirmar}>
            {guardando ? 'Guardando…' : estado === 'GANADA' ? 'Confirmar ganada' : 'Confirmar perdida'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
