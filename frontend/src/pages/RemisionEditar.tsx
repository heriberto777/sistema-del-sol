import { FormEvent, useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { CardColapsable } from '../components/molecules/CardColapsable/CardColapsable';
import { Select } from '../components/atoms/Select/Select';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { SelectorLineaProducto } from '../components/molecules/SelectorLineaProducto/SelectorLineaProducto';
import { Button } from '../components/atoms/Button/Button';
import { PaginaResultado } from '../types/pagina-resultado';
import { useHayCambios } from '../hooks/useHayCambios';
import type { Bodega, Cliente, Producto, Remision, LineaForm } from '../components/organisms/RemisionesPanel/RemisionesPanel';

export function RemisionEditar() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [valores, setValores] = useState<{ bodegaId: string; lineas: LineaForm[] } | null>(null);
  // Modelo A de "más espacio para líneas" — arranca colapsada apenas
  // carga el detalle (ver el comentario equivalente en FacturacionNueva.tsx).
  const [infoColapsada, setInfoColapsada] = useState(false);

  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  const { data: detalle } = useQuery({
    queryKey: ['remision-detalle', id],
    queryFn: async () => (await apiClient.get<Remision>(`/remisiones/${id}`)).data,
    enabled: !!id,
  });

  useEffect(() => {
    if (!detalle) return;
    setCliente({ id: detalle.clienteId, nombre: detalle.cliente.nombre });
    setValores({
      bodegaId: detalle.bodegaId,
      lineas: detalle.lineas.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId, cantidad: l.cantidad })),
    });
    setInfoColapsada(true);
  }, [detalle]);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/remisiones/${id}`, {
        clienteId: cliente?.id,
        bodegaId: valores!.bodegaId,
        lineas: valores!.lineas
          .filter((l) => l.productoId)
          .map((l) => ({ productoId: l.productoId, varianteId: l.varianteId || undefined, cantidad: Number(l.cantidad) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remisiones'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de guardar bien.
      confirmarGuardado();
      setTimeout(() => navigate('/remisiones'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la remisión. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cliente) {
      setInfoColapsada(false);
      setError('Seleccioná un cliente.');
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

  const cantidadLineas = valores.lineas.filter((l) => l.productoId).length;
  const bodegaSeleccionada = (bodegas ?? []).find((b) => b.id === valores.bodegaId);

  return (
    <PaginaDocumento
      titulo={`Editar remisión ${detalle?.numero ?? ''}`}
      rutaVolver="/remisiones"
      etiquetaVolver="Volver a Remisiones"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cliente?.nombre ?? 'Sin seleccionar'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Bodega</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{bodegaSeleccionada?.nombre ?? 'Sin seleccionar'}</span>
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
          <Button type="submit" form="form-editar-remision" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/remisiones')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-editar-remision" onSubmit={onSubmit} className="space-y-4">
        <CardColapsable
          titulo={`Editar remisión ${detalle?.numero ?? ''}`}
          colapsada={infoColapsada}
          onToggle={() => setInfoColapsada((v) => !v)}
          resumen={cliente ? `${cliente.nombre} · ${bodegaSeleccionada?.nombre ?? 'Sin bodega'}` : 'Sin cliente seleccionado'}
        >
          <p className="text-sm text-slate-500 dark:text-slate-400 sm:col-span-2">
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
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
            <Select value={valores.bodegaId} onChange={(e) => setValores({ ...valores, bodegaId: e.target.value })} required>
              <option value="">Seleccionar…</option>
              {(bodegas ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </Select>
          </div>
        </CardColapsable>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
          {valores.lineas.map((linea, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <SelectorLineaProducto
                productos={productos ?? []}
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
            onClick={() => setValores({ ...valores, lineas: [...valores.lineas, { productoId: '', varianteId: '', cantidad: '1' }] })}
          >
            + Línea
          </Button>
        </div>
      </form>
    </PaginaDocumento>
  );
}
