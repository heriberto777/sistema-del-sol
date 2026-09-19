import { FormEvent, useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { FormField } from '../components/molecules/FormField/FormField';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { SelectorLineaProducto } from '../components/molecules/SelectorLineaProducto/SelectorLineaProducto';
import { Button } from '../components/atoms/Button/Button';
import { PaginaResultado } from '../types/pagina-resultado';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { useHayCambios } from '../hooks/useHayCambios';
import { estimarLineas } from '../lib/estimar-totales-documento';
import type { Cliente, Cotizacion, Producto, LineaForm } from '../components/organisms/CotizacionesPanel/CotizacionesPanel';

export function CotizacionEditar() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [valores, setValores] = useState<{ fechaVigenciaHasta: string; lineas: LineaForm[] } | null>(null);

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });

  const { data: detalle } = useQuery({
    queryKey: ['cotizacion-detalle', id],
    queryFn: async () => (await apiClient.get<Cotizacion>(`/cotizaciones/${id}`)).data,
    enabled: !!id,
  });

  useEffect(() => {
    if (!detalle) return;
    setCliente({ id: detalle.clienteId, nombre: detalle.cliente.nombre });
    setValores({
      fechaVigenciaHasta: detalle.fechaVigenciaHasta.slice(0, 10),
      lineas: detalle.lineas.map((l) => ({
        productoId: l.productoId ?? '',
        varianteId: l.varianteId ?? '',
        cantidad: l.cantidad,
        esManual: !l.productoId,
        descripcionManual: l.descripcionManual ?? '',
        precioUnitario: l.precioUnitario,
      })),
    });
  }, [detalle]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/cotizaciones/${id}`, {
        clienteId: cliente?.id,
        fechaVigenciaHasta: valores!.fechaVigenciaHasta,
        lineas: valores!.lineas
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
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la cotización. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cliente) {
      setError('Seleccioná un cliente.');
      return;
    }
    if (valores!.lineas.some((l) => l.esManual && l.descripcionManual.trim() && !l.precioUnitario)) {
      setError('Una línea de producto libre necesita un precio.');
      return;
    }
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ cliente, valores }, valores !== null);

  if (!valores) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
      </div>
    );
  }

  const cantidadLineas = valores.lineas.filter((l) => l.productoId || (l.esManual && l.descripcionManual.trim())).length;
  const { subtotal, itbis } = estimarLineas(valores.lineas);
  const total = subtotal + itbis;

  return (
    <PaginaDocumento
      titulo={`Editar cotización ${detalle?.numero ?? ''}`}
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
          <Button type="submit" form="form-editar-cotizacion" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/cotizaciones')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-editar-cotizacion" onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Número <span className="font-medium text-slate-700 dark:text-slate-300">{detalle?.numero}</span> (asignado automáticamente, no editable)
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
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
          id="editar-vigencia"
          label="Válida hasta"
          type="date"
          value={valores.fechaVigenciaHasta}
          onChange={(e) => setValores({ ...valores, fechaVigenciaHasta: e.target.value })}
          required
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
          {valores.lineas.map((linea, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              {linea.esManual ? (
                <input
                  type="text"
                  placeholder="Descripción — ej. Instalación"
                  value={linea.descripcionManual}
                  onChange={(e) =>
                    setValores({ ...valores, lineas: valores.lineas.map((l, idx) => (idx === i ? { ...l, descripcionManual: e.target.value } : l)) })
                  }
                  className="min-w-[160px] flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              ) : (
                <SelectorLineaProducto
                  productos={productos ?? []}
                  productoId={linea.productoId}
                  varianteId={linea.varianteId}
                  onChange={(productoId, varianteId, precioReferencia, itbisReferencia) =>
                    setValores({
                      ...valores,
                      lineas: valores.lineas.map((l, idx) => (idx === i ? { ...l, productoId, varianteId, precioReferencia, itbisReferencia } : l)),
                    })
                  }
                  className="min-w-[160px] flex-1"
                />
              )}
              <input
                type="number"
                min={1}
                step="any"
                value={linea.cantidad}
                onChange={(e) =>
                  setValores({ ...valores, lineas: valores.lineas.map((l, idx) => (idx === i ? { ...l, cantidad: e.target.value } : l)) })
                }
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {linea.esManual && (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Precio"
                  value={linea.precioUnitario}
                  onChange={(e) =>
                    setValores({ ...valores, lineas: valores.lineas.map((l, idx) => (idx === i ? { ...l, precioUnitario: e.target.value } : l)) })
                  }
                  className="w-28 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              )}
              <button
                type="button"
                title={linea.esManual ? 'Volver a elegir del catálogo' : 'Línea libre sin producto del catálogo (ítem B-9)'}
                onClick={() =>
                  setValores({
                    ...valores,
                    lineas: valores.lineas.map((l, idx) =>
                      idx === i ? { ...l, esManual: !l.esManual, productoId: '', varianteId: '', descripcionManual: '' } : l,
                    ),
                  })
                }
                className="whitespace-nowrap text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
              >
                {linea.esManual ? 'Del catálogo' : 'Producto libre'}
              </button>
              {valores.lineas.length > 1 && (
                <Button
                  type="button"
                  variante="secundario"
                  onClick={() => setValores({ ...valores, lineas: valores.lineas.filter((_, idx) => idx !== i) })}
                >
                  Quitar
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variante="secundario"
            onClick={() =>
              setValores({
                ...valores,
                lineas: [...valores.lineas, { productoId: '', varianteId: '', cantidad: '1', esManual: false, descripcionManual: '', precioUnitario: '' }],
              })
            }
          >
            + Línea
          </Button>
        </div>
      </form>
    </PaginaDocumento>
  );
}
