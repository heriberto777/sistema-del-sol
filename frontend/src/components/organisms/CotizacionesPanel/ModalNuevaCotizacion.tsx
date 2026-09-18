import { FormEvent, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { ModalDocumento } from '../../molecules/ModalDocumento/ModalDocumento';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { ComboboxBusqueda } from '../../molecules/ComboboxBusqueda/ComboboxBusqueda';
import { TablaLineasEditable } from '../../molecules/TablaLineasEditable/TablaLineasEditable';
import { Button } from '../../atoms/Button/Button';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Cliente, Producto, LineaForm, LINEA_VACIA } from './CotizacionesPanel';

export function ModalNuevaCotizacion({ productos, onClose }: { productos: Producto[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fechaVigenciaHasta, setFechaVigenciaHasta] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([LINEA_VACIA]);
  const [error, setError] = useState<string | null>(null);

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
      onClose();
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

  return (
    <ModalDocumento
      titulo="Nueva cotización"
      onClose={onClose}
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
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nueva-cotizacion" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear cotización'}
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
            productos={productos}
            lineaVacia={LINEA_VACIA}
            onActualizar={actualizarLinea}
            onQuitar={(i) => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
            onAgregar={(vacia) => setLineas((prev) => [...prev, vacia])}
            precioSoloManual
          />
        </Card>
      </form>
    </ModalDocumento>
  );
}
