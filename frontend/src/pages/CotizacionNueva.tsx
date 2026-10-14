import { FormEvent, useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { CardColapsable } from '../components/molecules/CardColapsable/CardColapsable';
import { FormField } from '../components/molecules/FormField/FormField';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { TablaLineasEditable } from '../components/molecules/TablaLineasEditable/TablaLineasEditable';
import { Button } from '../components/atoms/Button/Button';
import { PaginaResultado } from '../types/pagina-resultado';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { useHayCambios } from '../hooks/useHayCambios';
import { estimarLineas } from '../lib/estimar-totales-documento';
import type { Cliente, Producto, LineaForm } from '../components/organisms/CotizacionesPanel/CotizacionesPanel';
import type { LineaPedidoSugerido } from '../types/crm';

const LINEA_VACIA: LineaForm = { productoId: '', varianteId: '', cantidad: '1', esManual: false, descripcionManual: '', precioUnitario: '', aplicaItbis: true };

/**
 * CRM "Cotización conectada" Fase 3 — `ActividadesCrmPanel` navega para
 * acá con esto en `location.state` cuando un vendedor usa un borrador de
 * pedido que el bot de WhatsApp sugirió. `clienteId` llega solo (sin
 * nombre) porque la actividad de origen no trae el Cliente completo
 * embebido — se resuelve acá con una consulta propia.
 */
export interface CotizacionNuevaState {
  clienteId: string;
  lineasSugeridas: LineaPedidoSugerido[];
}

function lineaDesdeSugerida(sugerida: LineaPedidoSugerido): LineaForm {
  return sugerida.productoId
    ? { ...LINEA_VACIA, productoId: sugerida.productoId, cantidad: String(sugerida.cantidad) }
    : { ...LINEA_VACIA, esManual: true, descripcionManual: sugerida.nombre, cantidad: String(sugerida.cantidad) };
}

export function CotizacionNueva() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const estadoInicial = location.state as CotizacionNuevaState | null;
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fechaVigenciaHasta, setFechaVigenciaHasta] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>(estadoInicial?.lineasSugeridas?.length ? estadoInicial.lineasSugeridas.map(lineaDesdeSugerida) : [LINEA_VACIA]);
  const [error, setError] = useState<string | null>(null);
  // Modelo A de "más espacio para líneas" — ver el comentario equivalente en FacturacionNueva.tsx.
  const [infoColapsada, setInfoColapsada] = useState(false);

  useEffect(() => {
    if (cliente) setInfoColapsada(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente?.id]);

  // CRM "Cotización conectada" Fase 3 — preselecciona el cliente cuando se
  // llega desde "Usar esta sugerencia" (ComboboxBusqueda necesita el
  // nombre, no solo el id, para mostrar el valor ya elegido).
  useQuery({
    queryKey: ['cliente-preseleccionado', estadoInicial?.clienteId],
    queryFn: async () => {
      const { data } = await apiClient.get<Cliente>(`/clientes/${estadoInicial!.clienteId}`);
      setCliente(data);
      return data;
    },
    enabled: !!estadoInicial?.clienteId,
  });

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/cotizaciones', {
        clienteId: cliente?.id,
        fechaVigenciaHasta,
        lineas: lineas
          .filter((l) => l.productoId || (l.esManual && l.descripcionManual.trim()))
          .map((l) =>
            l.esManual
              ? {
                  descripcionManual: l.descripcionManual.trim(),
                  cantidad: Number(l.cantidad),
                  precioUnitario: Number(l.precioUnitario),
                  aplicaItbis: l.aplicaItbis,
                }
              : { productoId: l.productoId, varianteId: l.varianteId || undefined, cantidad: Number(l.cantidad), aplicaItbis: l.aplicaItbis },
          ),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de guardar bien.
      confirmarGuardado();
      setTimeout(() => navigate('/cotizaciones'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la cotización. Revisa los datos.')),
  });

  function actualizarLinea(index: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...cambios } : l)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cliente) {
      setInfoColapsada(false);
      setError('Seleccioná un cliente.');
      return;
    }
    if (lineas.some((l) => l.esManual && l.descripcionManual.trim() && !l.precioUnitario)) {
      setError('Una línea de producto libre necesita un precio.');
      return;
    }
    crear.mutate();
  }

  const cantidadLineas = lineas.filter((l) => l.productoId || (l.esManual && l.descripcionManual.trim())).length;
  const { subtotal, itbis } = estimarLineas(lineas);
  const total = subtotal + itbis;
  const [haycambios, confirmarGuardado] = useHayCambios({ cliente, fechaVigenciaHasta, lineas });

  return (
    <PaginaDocumento
      titulo="Nueva cotización"
      rutaVolver="/cotizaciones"
      etiquetaVolver="Volver a Cotizaciones"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cliente?.nombre ?? 'Sin seleccionar'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Líneas</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {cantidadLineas} {cantidadLineas === 1 ? 'artículo' : 'artículos'}
            </span>
          </div>

          <div className="flex flex-col gap-2 rounded-lg bg-sol-50 p-3 dark:bg-sol-950/30">
            <span className="text-xs font-medium uppercase tracking-wide text-sol-700 dark:text-sol-400">Resumen estimado</span>
            <div className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>ITBIS</span>
                <span className="font-mono tabular-nums">RD$ {itbis.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between border-t border-sol-200 pt-2 dark:border-sol-800">
              <span className="text-xs font-semibold uppercase tracking-wide text-sol-700 dark:text-sol-400">Total estimado</span>
              <span className="text-lg font-bold text-sol-800 dark:text-sol-300">
                RD$ {total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-[11px] leading-snug text-sol-700/70 dark:text-sol-400/70">El total exacto se calcula al guardar.</span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nueva-cotizacion" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear cotización'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/cotizaciones')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-cotizacion" onSubmit={onSubmit} className="space-y-4">
        <CardColapsable
          titulo="Información de la cotización"
          colapsada={infoColapsada}
          onToggle={() => setInfoColapsada((v) => !v)}
          resumen={cliente ? `${cliente.nombre}${fechaVigenciaHasta ? ` · Válida hasta ${fechaVigenciaHasta}` : ''}` : 'Sin cliente seleccionado'}
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
            <ComboboxBusqueda<Cliente>
              valor={cliente}
              onSeleccionar={setCliente}
              obtenerId={(c) => c.id}
              obtenerEtiqueta={(c) => c.nombre}
              placeholder="Buscar cliente…"
              icono={<User size={15} />}
              buscar={async (texto) =>
                (await apiClient.get<PaginaResultado<Cliente>>('/clientes', { params: { busqueda: texto, tamanoPagina: 10 } })).data.datos
              }
            />
          </div>
          <FormField
            id="fechaVigenciaHasta"
            label="Válida hasta"
            type="date"
            value={fechaVigenciaHasta}
            onChange={(e) => setFechaVigenciaHasta(e.target.value)}
            required
          />
        </CardColapsable>

        <Card titulo="Líneas">
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
        </Card>
      </form>
    </PaginaDocumento>
  );
}
