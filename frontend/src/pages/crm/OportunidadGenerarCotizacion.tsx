import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { FormField } from '../../components/molecules/FormField/FormField';
import { TablaLineasEditable } from '../../components/molecules/TablaLineasEditable/TablaLineasEditable';
import { estimarLineas } from '../../lib/estimar-totales-documento';
import { useHayCambios } from '../../hooks/useHayCambios';
import { Oportunidad } from '../../types/crm';
import type { Producto, LineaForm } from '../../components/organisms/CotizacionesPanel/CotizacionesPanel';
import { PaginaResultado } from '../../types/pagina-resultado';

interface OportunidadConvertidaResponse {
  cotizacion: { id: string } | null;
}

const LINEA_VACIA: LineaForm = { productoId: '', varianteId: '', cantidad: '1', esManual: false, descripcionManual: '', precioUnitario: '', aplicaItbis: true };

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * ModalGenerarCotizacionOportunidad de CrmPipelinePanel.tsx. Página propia
 * (no un toggle en OportunidadVer) por el tamaño del formulario —
 * TablaLineasEditable completa, igual que CotizacionNueva.
 */
export function OportunidadGenerarCotizacion() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: oportunidad } = useQuery({
    queryKey: ['crm-oportunidad', id],
    queryFn: async () => (await apiClient.get<Oportunidad>(`/crm/oportunidades/${id}`)).data,
  });
  const esLeadSinCliente = !!oportunidad && !oportunidad.clienteId;

  const [fechaVigencia, setFechaVigencia] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([LINEA_VACIA]);
  const [cargado, setCargado] = useState(false);
  const [tipoClienteNuevo, setTipoClienteNuevo] = useState<'PERSONA_FISICA' | 'PERSONA_JURIDICA'>('PERSONA_FISICA');
  const [rncCedulaClienteNuevo, setRncCedulaClienteNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (oportunidad && !cargado) {
      setLineas([{ ...LINEA_VACIA, esManual: true, descripcionManual: oportunidad.titulo, precioUnitario: oportunidad.montoEstimado }]);
      setCargado(true);
    }
  }, [oportunidad, cargado]);

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  function actualizarLinea(index: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  const generar = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<OportunidadConvertidaResponse>(`/crm/oportunidades/${id}/convertir`, {
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
      if (data.cotizacion) {
        await apiClient.patch(`/cotizaciones/${data.cotizacion.id}/estado`, { estado: 'ENVIADA' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['crm-oportunidad', id] });
      confirmarGuardado();
      setTimeout(() => navigate(`/crm/oportunidades/${id}`), 0);
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
  const [haycambios, confirmarGuardado] = useHayCambios({ fechaVigencia, lineas }, cargado);

  return (
    <PaginaDocumento
      titulo={oportunidad ? `Generar cotización — ${oportunidad.titulo}` : 'Generar cotización'}
      rutaVolver={`/crm/oportunidades/${id}`}
      etiquetaVolver="Volver a la oportunidad"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Subtotal estimado</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total estimado</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {(subtotal + itbis).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="button" disabled={generar.isPending} className="w-full" onClick={confirmar}>
            {generar.isPending ? 'Generando…' : 'Generar y enviar'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/crm/oportunidades/${id}`)}>
            Cancelar
          </Button>
        </>
      }
    >
      {!oportunidad ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Para {oportunidad.cliente?.nombre ?? oportunidad.lead?.nombre}
            {esLeadSinCliente && ' — esto también convierte el lead en cliente'}. La oportunidad sigue abierta hasta que el cliente responda.
          </p>

          <Card titulo="Vigencia">
            <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
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
          </Card>

          <Card titulo="Líneas">
            <div className="sm:col-span-2">
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
            </div>
          </Card>
        </div>
      )}
    </PaginaDocumento>
  );
}
