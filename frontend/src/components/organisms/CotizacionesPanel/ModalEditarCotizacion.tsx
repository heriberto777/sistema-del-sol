import { FormEvent, useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { FormField } from '../../molecules/FormField/FormField';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { SelectorLineaProducto } from '../../molecules/SelectorLineaProducto/SelectorLineaProducto';
import { Button } from '../../atoms/Button/Button';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Cliente, Cotizacion, Producto, LineaForm, LINEA_VACIA } from './CotizacionesPanel';

export function ModalEditarCotizacion({
  cotizacionId,
  numeroActual,
  productos,
  onClose,
}: {
  cotizacionId: string;
  numeroActual: string;
  productos: Producto[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [valores, setValores] = useState<{ fechaVigenciaHasta: string; lineas: LineaForm[] } | null>(null);

  const { data: detalle } = useQuery({
    queryKey: ['cotizacion-detalle', cotizacionId],
    queryFn: async () => (await apiClient.get<Cotizacion>(`/cotizaciones/${cotizacionId}`)).data,
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
      apiClient.patch(`/cotizaciones/${cotizacionId}`, {
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
      onClose();
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

  if (!valores) {
    return (
      <Modal titulo={`Editar cotización ${numeroActual}`} onClose={onClose}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
      </Modal>
    );
  }

  return (
    <Modal titulo={`Editar cotización ${numeroActual}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Número <span className="font-medium text-slate-700 dark:text-slate-300">{numeroActual}</span> (asignado automáticamente, no editable)
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
                  productos={productos}
                  productoId={linea.productoId}
                  varianteId={linea.varianteId}
                  onChange={(productoId, varianteId) =>
                    setValores({
                      ...valores,
                      lineas: valores.lineas.map((l, idx) => (idx === i ? { ...l, productoId, varianteId } : l)),
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
          <Button type="button" variante="secundario" onClick={() => setValores({ ...valores, lineas: [...valores.lineas, LINEA_VACIA] })}>
            + Línea
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Modal>
  );
}
