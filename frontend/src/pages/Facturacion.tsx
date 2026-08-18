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
import { PaginaResultado } from '../types/pagina-resultado';

interface Cliente {
  id: string;
  nombre: string;
}

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
}

interface Bodega {
  id: string;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Facturación</h1>
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
  const [lineas, setLineas] = useState([{ productoId: '', cantidad: '1', precioUnitario: '' }]);
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: clientes } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Cliente>>('/clientes', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const { data: productos } = useQuery({
    queryKey: ['productos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<Producto>>('/productos', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
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
        lineas: lineas
          .filter((l) => l.productoId)
          .map((l) => ({
            productoId: l.productoId,
            cantidad: Number(l.cantidad),
            precioUnitario: l.precioUnitario ? Number(l.precioUnitario) : undefined,
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
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega (de donde sale el inventario)</label>
          <Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {bodegas?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
          <Select value={tipoFactura} onChange={(e) => setTipoFactura(e.target.value as 'CONTADO' | 'CREDITO')}>
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Líneas</p>
          {lineas.map((linea, i) => (
            <div key={i} className="flex gap-2">
              <Select
                value={linea.productoId}
                onChange={(e) => actualizarLinea(i, { productoId: e.target.value })}
                required
                className="flex-1"
              >
                <option value="">Producto…</option>
                {productos?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.nombre}
                  </option>
                ))}
              </Select>
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
            onClick={() => setLineas((prev) => [...prev, { productoId: '', cantidad: '1', precioUnitario: '' }])}
            className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            + Agregar línea
          </button>
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
