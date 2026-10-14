import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { FormField } from '../../molecules/FormField/FormField';
import { TablaLineasEditable } from '../../molecules/TablaLineasEditable/TablaLineasEditable';
import { Button } from '../../atoms/Button/Button';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { estimarLineas } from '../../../lib/estimar-totales-documento';
import { Oportunidad } from '../../../types/crm';
import type { Producto, LineaForm } from '../CotizacionesPanel/CotizacionesPanel';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface OportunidadConvertidaResponse {
  cotizacion: { id: string } | null;
}

const LINEA_VACIA: LineaForm = { productoId: '', varianteId: '', cantidad: '1', esManual: false, descripcionManual: '', precioUnitario: '', aplicaItbis: true };

/**
 * CRM "Cotización conectada" — reemplaza el checkbox "generar cotización
 * ahora mismo" que vivía en ModalCerrarOportunidad (armaba una única
 * línea manual con el título/monto estimado): ahora el vendedor arma
 * líneas reales del catálogo acá, reusando el mismo `TablaLineasEditable`
 * que ya usan CotizacionNueva/FacturacionNueva — nada de UI nueva que
 * mantener por separado. Arranca con una línea prellenada (título +
 * monto estimado) como punto de partida editable, no como obligación.
 *
 * Generar la cotización NO gana la oportunidad — sigue ABIERTA hasta que
 * el cliente la aprueba desde el link público y el vendedor la convierte
 * en factura (ver el artifact de diseño "CRM Conectado").
 */
export function ModalGenerarCotizacionOportunidad({ oportunidad, onClose }: { oportunidad: Oportunidad; onClose: () => void }) {
  const queryClient = useQueryClient();
  const esLeadSinCliente = !oportunidad.clienteId;

  const [fechaVigencia, setFechaVigencia] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([
    { ...LINEA_VACIA, esManual: true, descripcionManual: oportunidad.titulo, precioUnitario: oportunidad.montoEstimado },
  ]);
  const [tipoClienteNuevo, setTipoClienteNuevo] = useState<'PERSONA_FISICA' | 'PERSONA_JURIDICA'>('PERSONA_FISICA');
  const [rncCedulaClienteNuevo, setRncCedulaClienteNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  function actualizarLinea(index: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  const generar = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<OportunidadConvertidaResponse>(`/crm/oportunidades/${oportunidad.id}/convertir`, {
        fechaVigenciaHastaCotizacion: fechaVigencia,
        lineas: lineas
          .filter((l) => l.productoId || (l.esManual && l.descripcionManual.trim()))
          .map((l) =>
            l.esManual
              ? { descripcionManual: l.descripcionManual.trim(), cantidad: Number(l.cantidad), precioUnitario: Number(l.precioUnitario), aplicaItbis: l.aplicaItbis }
              : { productoId: l.productoId, varianteId: l.varianteId || undefined, cantidad: Number(l.cantidad), aplicaItbis: l.aplicaItbis },
          ),
        ...(esLeadSinCliente ? { tipoClienteNuevo, rncCedulaClienteNuevo: rncCedulaClienteNuevo || undefined } : {}),
      });
      // La cotización nace BORRADOR — "Generar y enviar" significa que el
      // cliente la recibe en este mismo paso, no en dos viajes separados.
      if (data.cotizacion) {
        await apiClient.patch(`/cotizaciones/${data.cotizacion.id}/estado`, { estado: 'ENVIADA' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo generar la cotización.')),
  });

  function confirmar() {
    setError(null);
    if (!fechaVigencia) {
      setError('Elegí una fecha de vigencia para la cotización.');
      return;
    }
    if (!lineas.some((l) => l.productoId || (l.esManual && l.descripcionManual.trim()))) {
      setError('Agregá al menos una línea.');
      return;
    }
    generar.mutate();
  }

  const { subtotal, itbis } = estimarLineas(lineas);

  return (
    <Modal titulo={`Generar cotización — ${oportunidad.titulo}`} onClose={onClose} ancho="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Para {oportunidad.cliente?.nombre ?? oportunidad.lead?.nombre}
          {esLeadSinCliente && ' — esto también convierte el lead en cliente'}. La oportunidad sigue abierta hasta que el cliente responda.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <FormField id="op-fecha-vigencia" label="Válida hasta" type="date" value={fechaVigencia} onChange={(e) => setFechaVigencia(e.target.value)} required />
          {esLeadSinCliente && (
            <>
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
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </>
          )}
        </div>

        <TablaLineasEditable
          lineas={lineas}
          productos={productos ?? []}
          lineaVacia={LINEA_VACIA}
          onActualizar={actualizarLinea}
          onQuitar={(i) => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
          onAgregar={(vacia) => setLineas((prev) => [...prev, vacia])}
          precioSoloManual
          mostrarItbis
        />

        <div className="flex justify-end gap-4 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            Subtotal estimado: RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            Total estimado: RD$ {(subtotal + itbis).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={generar.isPending} onClick={confirmar}>
            {generar.isPending ? 'Generando…' : 'Generar y enviar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
