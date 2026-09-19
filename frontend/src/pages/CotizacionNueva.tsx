import { FormEvent, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { FormField } from '../components/molecules/FormField/FormField';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { TablaLineasEditable } from '../components/molecules/TablaLineasEditable/TablaLineasEditable';
import { Button } from '../components/atoms/Button/Button';
import { PaginaResultado } from '../types/pagina-resultado';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { useHayCambios } from '../hooks/useHayCambios';
import { estimarLineas } from '../lib/estimar-totales-documento';
import type { Cliente, Producto, LineaForm } from '../components/organisms/CotizacionesPanel/CotizacionesPanel';

const LINEA_VACIA: LineaForm = { productoId: '', varianteId: '', cantidad: '1', esManual: false, descripcionManual: '', precioUnitario: '' };

export function CotizacionNueva() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fechaVigenciaHasta, setFechaVigenciaHasta] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([LINEA_VACIA]);
  const [error, setError] = useState<string | null>(null);

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
              ? { descripcionManual: l.descripcionManual.trim(), cantidad: Number(l.cantidad), precioUnitario: Number(l.precioUnitario) }
              : { productoId: l.productoId, varianteId: l.varianteId || undefined, cantidad: Number(l.cantidad) },
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
        <Card titulo="Información de la cotización" contentClassName="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </Card>

        <Card titulo="Líneas">
          <TablaLineasEditable
            lineas={lineas}
            productos={productos ?? []}
            lineaVacia={LINEA_VACIA}
            onActualizar={actualizarLinea}
            onQuitar={(i) => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
            onAgregar={(vacia) => setLineas((prev) => [...prev, vacia])}
            precioSoloManual
          />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
