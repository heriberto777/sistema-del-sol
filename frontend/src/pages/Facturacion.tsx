import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { FacturasTable } from '../components/organisms/FacturasTable/FacturasTable';
import { EmitirNotaForm } from '../components/organisms/EmitirNotaForm/EmitirNotaForm';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { useListasPrecio } from '../hooks/useListasPrecio';
import { SelectorLineaProducto } from '../components/molecules/SelectorLineaProducto/SelectorLineaProducto';
import { SelectorBodega } from '../components/molecules/SelectorBodega/SelectorBodega';
import { PaginaResultado } from '../types/pagina-resultado';

interface Cliente {
  id: string;
  nombre: string;
  listaPrecio: { id: string; nombre: string } | null;
  comprobantePorDefecto: 'CONTADO' | 'CREDITO' | 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL' | null;
}

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
}

export function Facturacion() {
  const { tienePermiso } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalNuevaFactura, setModalNuevaFactura] = useState(false);
  const [modalNota, setModalNota] = useState(false);

  useEffect(() => {
    if (searchParams.get('crear') === '1') {
      setModalNuevaFactura(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Facturación</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Facturas emitidas a tus clientes.</p>
        </div>
        <div className="flex gap-2">
          {tienePermiso('facturacion.crear') && (
            <Button variante="secundario" onClick={() => setModalNota(true)}>
              Emitir nota
            </Button>
          )}
          {tienePermiso('facturacion.crear') && <Button onClick={() => setModalNuevaFactura(true)}>Nueva factura</Button>}
        </div>
      </div>
      <RequierePermiso permiso="facturacion.ver">
        <FacturasTable />
      </RequierePermiso>

      {modalNuevaFactura && <ModalNuevaFactura onClose={() => setModalNuevaFactura(false)} />}
      {modalNota && <EmitirNotaForm onClose={() => setModalNota(false)} />}
    </div>
  );
}

function ModalNuevaFactura({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [clienteId, setClienteId] = useState('');
  const [bodegaId, setBodegaId] = useState('');
  const [tipoFactura, setTipoFactura] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [tipoComprobanteEspecial, setTipoComprobanteEspecial] = useState('');
  const [plazoPagoDias, setPlazoPagoDias] = useState(30);
  const [lineas, setLineas] = useState([{ productoId: '', varianteId: '', cantidad: '1', precioUnitario: '', aplicaItbis: true }]);
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [listaPrecioOverride, setListaPrecioOverride] = useState('');
  const [descuentoGeneralTipo, setDescuentoGeneralTipo] = useState<'' | 'PCT' | 'MONTO'>('');
  const [descuentoGeneralValor, setDescuentoGeneralValor] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: clientes } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Cliente>>('/clientes', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const { data: listasPrecio } = useListasPrecio();
  const clienteSeleccionado = clientes?.find((c) => c.id === clienteId);
  const listaPrecioResuelta = clienteSeleccionado?.listaPrecio?.nombre ?? 'GENERAL';

  // Comprobante fiscal por defecto del cliente (plan de integración Cuadre,
  // ítem E-5) — autoselecciona tipoFactura + tipoComprobanteEspecial al
  // elegir el cliente; el usuario puede cambiarlo igual después, es solo un
  // valor inicial. CONTADO/CREDITO fijan tipoFactura y limpian el especial;
  // REGIMEN_ESPECIAL/GUBERNAMENTAL solo fijan el especial (tipoFactura queda
  // en lo que ya estuviera — ver TIPO_NCF_ESPECIAL en facturacion.service.ts).
  useEffect(() => {
    const defecto = clienteSeleccionado?.comprobantePorDefecto;
    if (!defecto) return;
    if (defecto === 'CONTADO' || defecto === 'CREDITO') {
      setTipoFactura(defecto);
      setTipoComprobanteEspecial('');
    } else {
      setTipoComprobanteEspecial(defecto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });
  function actualizarLinea(i: number, cambios: Partial<(typeof lineas)[number]>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/facturas', {
        clienteId,
        bodegaId,
        tipoFactura,
        tipoComprobanteEspecial: tipoComprobanteEspecial || undefined,
        listaPrecio: listaPrecioOverride || undefined,
        plazoPagoDias: tipoFactura === 'CREDITO' ? plazoPagoDias : undefined,
        descuentoGeneralPct: descuentoGeneralTipo === 'PCT' && descuentoGeneralValor ? Number(descuentoGeneralValor) : undefined,
        descuentoGeneralMonto: descuentoGeneralTipo === 'MONTO' && descuentoGeneralValor ? Number(descuentoGeneralValor) : undefined,
        lineas: lineas
          .filter((l) => l.productoId)
          .map((l) => ({
            productoId: l.productoId,
            varianteId: l.varianteId || undefined,
            cantidad: Number(l.cantidad),
            precioUnitario: l.precioUnitario ? Number(l.precioUnitario) : undefined,
            aplicaItbis: l.aplicaItbis,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      onClose();
    },
    onError: () => setError('No se pudo crear la factura. Revisa los datos y el stock disponible.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.filter((l) => l.productoId).length === 0) {
      setError('Agregá al menos una línea con producto.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva factura" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</label>
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {clientes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => setMostrarNuevoCliente((v) => !v)}
            className="self-start text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            + Nuevo cliente
          </button>
          {mostrarNuevoCliente && (
            <NuevoClienteInline
              onCreado={(c) => {
                setClienteId(c.id);
                setMostrarNuevoCliente(false);
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nivel de precio</label>
          <Select value={listaPrecioOverride} onChange={(e) => setListaPrecioOverride(e.target.value)}>
            <option value="">Usar el del cliente ({listaPrecioResuelta})</option>
            {listasPrecio?.map((lista) => (
              <option key={lista.id} value={lista.nombre}>
                {lista.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega (de donde sale el inventario)</label>
          <SelectorBodega value={bodegaId} onChange={setBodegaId} required />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
          <Select value={tipoFactura} onChange={(e) => setTipoFactura(e.target.value as 'CONTADO' | 'CREDITO')}>
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </Select>
        </div>

        {tipoFactura === 'CREDITO' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Condición de pago (plan de integración Cuadre, ítem B-6)
              </label>
              <Select value={plazoPagoDias} onChange={(e) => setPlazoPagoDias(Number(e.target.value))}>
                <option value={15}>15 días</option>
                <option value={30}>30 días</option>
                <option value={45}>45 días</option>
                <option value={60}>60 días</option>
                <option value={90}>90 días</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vencimiento</label>
              <input
                disabled
                value={new Date(Date.now() + plazoPagoDias * 86400000).toLocaleDateString('es-DO', { timeZone: 'UTC' })}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de comprobante</label>
          <Select value={tipoComprobanteEspecial} onChange={(e) => setTipoComprobanteEspecial(e.target.value)}>
            <option value="">Normal</option>
            <option value="REGIMEN_ESPECIAL">Régimen Especial (B14)</option>
            <option value="GUBERNAMENTAL">Gubernamental (B15)</option>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
          {lineas.map((linea, i) => (
            <div key={i} className="flex gap-2">
              <SelectorLineaProducto
                productos={productos ?? []}
                productoId={linea.productoId}
                varianteId={linea.varianteId}
                onChange={(productoId, varianteId) => actualizarLinea(i, { productoId, varianteId })}
                className="flex-1"
              />
              <input
                type="number"
                min={1}
                placeholder="Cant."
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Precio (opcional)"
                value={linea.precioUnitario}
                onChange={(e) => actualizarLinea(i, { precioUnitario: e.target.value })}
                className="w-32 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400" title="Toggle de ITBIS por línea">
                <input
                  type="checkbox"
                  checked={linea.aplicaItbis}
                  onChange={(e) => actualizarLinea(i, { aplicaItbis: e.target.checked })}
                />
                ITBIS
              </label>
              {lineas.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-600 hover:text-red-700"
                  aria-label="Quitar línea"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLineas((prev) => [...prev, { productoId: '', varianteId: '', cantidad: '1', precioUnitario: '', aplicaItbis: true }])}
            className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            + Agregar línea
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Descuento general de la factura (opcional, plan de integración Cuadre, ítem B-8)
          </label>
          <div className="flex gap-2">
            <Select value={descuentoGeneralTipo} onChange={(e) => setDescuentoGeneralTipo(e.target.value as '' | 'PCT' | 'MONTO')}>
              <option value="">Sin descuento general</option>
              <option value="PCT">% sobre el subtotal</option>
              <option value="MONTO">Monto fijo (RD$)</option>
            </Select>
            {descuentoGeneralTipo && (
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder={descuentoGeneralTipo === 'PCT' ? '% ej. 10' : 'RD$'}
                value={descuentoGeneralValor}
                onChange={(e) => setDescuentoGeneralValor(e.target.value)}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Se reparte proporcionalmente entre todas las líneas (recalcula el ITBIS), además de cualquier descuento por línea u oferta automática.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear factura'}
        </Button>
      </form>
    </Modal>
  );
}

function NuevoClienteInline({ onCreado }: { onCreado: (c: Cliente) => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => (await apiClient.post<Cliente>('/clientes', { nombre, tipo: 'PERSONA_FISICA' })).data,
    onSuccess: (cliente) => {
      queryClient.invalidateQueries({ queryKey: ['clientes-select'] });
      onCreado(cliente);
    },
    onError: () => setError('No se pudo crear el cliente.'),
  });

  return (
    <div className="mt-1 flex items-end gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800">
      <div className="flex-1">
        <FormField id="nuevo-cliente-nombre" label="Nombre del cliente" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <Button type="button" variante="secundario" disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
        Crear
      </Button>
    </div>
  );
}
