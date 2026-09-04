import { FormEvent, useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { FacturasTable } from '../components/organisms/FacturasTable/FacturasTable';
import { EmitirNotaForm } from '../components/organisms/EmitirNotaForm/EmitirNotaForm';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { useListasPrecio } from '../hooks/useListasPrecio';
import { TablaLineasEditable, LineaEditable } from '../components/molecules/TablaLineasEditable/TablaLineasEditable';
import { SelectorBodega } from '../components/molecules/SelectorBodega/SelectorBodega';
import { SelectFormaPago } from '../components/molecules/SelectFormaPago/SelectFormaPago';
import { PaginaResultado } from '../types/pagina-resultado';

interface Cliente {
  id: string;
  nombre: string;
  listaPrecio: { id: string; nombre: string } | null;
  comprobanteFiscalPorDefecto: 'CONSUMO' | 'CREDITO_FISCAL' | 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL' | null;
  condicionPagoPorDefecto: 'CONTADO' | 'CREDITO' | null;
  plazoPagoDias: number;
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
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [bodegaId, setBodegaId] = useState('');
  const [tipoFactura, setTipoFactura] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [comprobanteFiscal, setComprobanteFiscal] = useState<'CONSUMO' | 'CREDITO_FISCAL' | 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL'>('CONSUMO');
  const [plazoPagoDias, setPlazoPagoDias] = useState(30);
  // Ítem Cobranza — captura el cobro al crear una factura CONTADO fuera de
  // POS (igual que POS), para que quede un registro de pago y la factura
  // salga marcada como pagada.
  const [formaPagoId, setFormaPagoId] = useState('');
  const LINEA_VACIA: LineaEditable = { productoId: '', varianteId: '', descripcionManual: '', esManual: false, cantidad: '1', precioUnitario: '', aplicaItbis: true };
  const [lineas, setLineas] = useState<LineaEditable[]>([LINEA_VACIA]);
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [listaPrecioOverride, setListaPrecioOverride] = useState('');
  const [descuentoGeneralTipo, setDescuentoGeneralTipo] = useState<'' | 'PCT' | 'MONTO'>('');
  const [descuentoGeneralValor, setDescuentoGeneralValor] = useState('');
  const [recargos, setRecargos] = useState<{ concepto: string; monto: string; gravado: boolean }[]>([]);
  const [moneda, setMoneda] = useState('DOP');
  const [error, setError] = useState<string | null>(null);

  // Ítem C-2 (multi-moneda) — solo para mostrarle al cliente un
  // equivalente en el documento impreso; subtotal/itbis/total internos
  // siguen siempre en DOP.
  const { data: tasasCambio } = useQuery({
    queryKey: ['tasas-cambio'],
    queryFn: async () => (await apiClient.get<{ id: string; moneda: string; tasa: string }[]>('/tasas-cambio')).data,
  });

  const { data: listasPrecio } = useListasPrecio();
  const listaPrecioResuelta = cliente?.listaPrecio?.nombre ?? 'GENERAL';

  // Comprobante fiscal y opción de pago por defecto del cliente (ítem
  // "separar Comprobante Fiscal de Opción de Pago") — autoseleccionan,
  // cada uno por su lado, al elegir el cliente; el usuario puede cambiar
  // cualquiera de los dos después, son solo valores iniciales. Antes un
  // solo campo (comprobantePorDefecto) mezclaba ambos conceptos.
  useEffect(() => {
    if (cliente?.condicionPagoPorDefecto) setTipoFactura(cliente.condicionPagoPorDefecto);
    if (cliente?.comprobanteFiscalPorDefecto) setComprobanteFiscal(cliente.comprobanteFiscalPorDefecto);
    if (cliente) setPlazoPagoDias(cliente.plazoPagoDias);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente?.id]);
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
        clienteId: cliente?.id,
        bodegaId,
        tipoFactura,
        comprobanteFiscal,
        listaPrecio: listaPrecioOverride || undefined,
        plazoPagoDias: tipoFactura === 'CREDITO' ? plazoPagoDias : undefined,
        formaPagoId: tipoFactura === 'CONTADO' ? formaPagoId || undefined : undefined,
        descuentoGeneralPct: descuentoGeneralTipo === 'PCT' && descuentoGeneralValor ? Number(descuentoGeneralValor) : undefined,
        descuentoGeneralMonto: descuentoGeneralTipo === 'MONTO' && descuentoGeneralValor ? Number(descuentoGeneralValor) : undefined,
        moneda: moneda !== 'DOP' ? moneda : undefined,
        recargos: recargos
          .filter((r) => r.concepto.trim() && r.monto)
          .map((r) => ({ concepto: r.concepto.trim(), monto: Number(r.monto), gravado: r.gravado })),
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
              : {
                  productoId: l.productoId,
                  varianteId: l.varianteId || undefined,
                  cantidad: Number(l.cantidad),
                  precioUnitario: l.precioUnitario ? Number(l.precioUnitario) : undefined,
                  aplicaItbis: l.aplicaItbis,
                },
          ),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la factura. Revisa los datos y el stock disponible.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cliente) {
      setError('Seleccioná un cliente.');
      return;
    }
    if (lineas.filter((l) => l.productoId || (l.esManual && l.descripcionManual.trim())).length === 0) {
      setError('Agregá al menos una línea con producto.');
      return;
    }
    if (lineas.some((l) => l.esManual && l.descripcionManual.trim() && !l.precioUnitario)) {
      setError('Una línea de producto libre necesita un precio.');
      return;
    }
    if (tipoFactura === 'CONTADO' && !formaPagoId) {
      setError('Seleccioná la forma de pago.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva factura" onClose={onClose} ancho="2xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Información de la factura" contentClassName="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
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
                  setCliente(c);
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
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Opción de pago</label>
            <Select value={tipoFactura} onChange={(e) => setTipoFactura(e.target.value as 'CONTADO' | 'CREDITO')}>
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Comprobante fiscal</label>
            <Select
              value={comprobanteFiscal}
              onChange={(e) => setComprobanteFiscal(e.target.value as typeof comprobanteFiscal)}
            >
              <option value="CONSUMO">Consumo (B02)</option>
              <option value="CREDITO_FISCAL">Crédito Fiscal (B01)</option>
              <option value="REGIMEN_ESPECIAL">Régimen Especial (B14)</option>
              <option value="GUBERNAMENTAL">Gubernamental (B15)</option>
            </Select>
          </div>

          {tipoFactura === 'CONTADO' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Forma de pago</label>
              <SelectFormaPago value={formaPagoId} onChange={setFormaPagoId} />
            </div>
          )}

          {tipoFactura === 'CREDITO' && (
            <>
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
            </>
          )}

          {tasasCambio && tasasCambio.length > 0 && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Moneda de presentación (ítem C-2 — el total interno sigue en DOP)
              </label>
              <Select value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                <option value="DOP">DOP (sin equivalente)</option>
                {tasasCambio.map((t) => (
                  <option key={t.id} value={t.moneda}>
                    {t.moneda} (tasa {Number(t.tasa).toLocaleString('es-DO')})
                  </option>
                ))}
              </Select>
            </div>
          )}
        </Card>

        <Card titulo="Líneas">
          <TablaLineasEditable
            lineas={lineas}
            productos={productos ?? []}
            lineaVacia={LINEA_VACIA}
            onActualizar={actualizarLinea}
            onQuitar={(i) => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
            onAgregar={(vacia) => setLineas((prev) => [...prev, vacia])}
            mostrarItbis
          />
        </Card>

        <Card titulo="Descuento general y recargos">
          <div className="space-y-4">
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

            <div className="flex flex-col gap-1 border-t border-slate-100 pt-4 dark:border-slate-800">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Recargos (opcional, plan de integración Cuadre, ítem B-4)
              </label>
              {recargos.map((recargo, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Concepto — ej. Imprevistos"
                    value={recargo.concepto}
                    onChange={(e) => setRecargos((prev) => prev.map((r, idx) => (idx === i ? { ...r, concepto: e.target.value } : r)))}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="RD$"
                    value={recargo.monto}
                    onChange={(e) => setRecargos((prev) => prev.map((r, idx) => (idx === i ? { ...r, monto: e.target.value } : r)))}
                    className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={recargo.gravado}
                      onChange={(e) => setRecargos((prev) => prev.map((r, idx) => (idx === i ? { ...r, gravado: e.target.checked } : r)))}
                    />
                    Gravado
                  </label>
                  <button
                    type="button"
                    onClick={() => setRecargos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-600 hover:text-red-700"
                    aria-label="Quitar recargo"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRecargos((prev) => [...prev, { concepto: '', monto: '', gravado: false }])}
                className="self-start text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
              >
                + Agregar recargo
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cargo aparte, después del subtotal y el descuento — "Gravado" le suma ITBIS a la tasa general del tenant.
              </p>
            </div>
          </div>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear factura'}
        </Button>
      </form>
    </Modal>
  );
}

function NuevoClienteInline({ onCreado }: { onCreado: (c: Cliente) => void }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => (await apiClient.post<Cliente>('/clientes', { nombre, tipo: 'PERSONA_FISICA' })).data,
    onSuccess: (cliente) => onCreado(cliente),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el cliente.')),
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
