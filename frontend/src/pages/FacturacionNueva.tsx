import { FormEvent, useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { CardColapsable } from '../components/molecules/CardColapsable/CardColapsable';
import { Select } from '../components/atoms/Select/Select';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { FormField } from '../components/molecules/FormField/FormField';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { TablaLineasEditable, LineaEditable } from '../components/molecules/TablaLineasEditable/TablaLineasEditable';
import { SelectorBodega } from '../components/molecules/SelectorBodega/SelectorBodega';
import { SelectFormaPago, type FormaPago } from '../components/molecules/SelectFormaPago/SelectFormaPago';
import { useListasPrecio } from '../hooks/useListasPrecio';
import { useHayCambios } from '../hooks/useHayCambios';
import { estimarLineas, ITBIS_GENERAL_ESTIMADO } from '../lib/estimar-totales-documento';
import { PaginaResultado } from '../types/pagina-resultado';
import type { ClienteCompleto } from '@backend-src/common/prisma/cliente-select-basico';
import type { BodegaBasica } from '@backend-src/common/prisma/bodega-select-basico';

type Cliente = ClienteCompleto;

interface Producto {
  id: string;
  codigo: string;
  nombre: string;
}

const LINEA_VACIA: LineaEditable = { productoId: '', varianteId: '', descripcionManual: '', esManual: false, cantidad: '1', precioUnitario: '', aplicaItbis: true };

const ETIQUETA_COMPROBANTE: Record<'CONSUMO' | 'CREDITO_FISCAL' | 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL', string> = {
  CONSUMO: 'Consumo (B02)',
  CREDITO_FISCAL: 'Crédito Fiscal (B01)',
  REGIMEN_ESPECIAL: 'Régimen Especial (B14)',
  GUBERNAMENTAL: 'Gubernamental (B15)',
};

export function FacturacionNueva() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [bodegaId, setBodegaId] = useState('');
  const [tipoFactura, setTipoFactura] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [comprobanteFiscal, setComprobanteFiscal] = useState<'CONSUMO' | 'CREDITO_FISCAL' | 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL'>('CONSUMO');
  const [plazoPagoDias, setPlazoPagoDias] = useState(30);
  // Ítem Cobranza — captura el cobro al crear una factura CONTADO fuera de
  // POS (igual que POS), para que quede un registro de pago y la factura
  // salga marcada como pagada.
  const [formaPagoId, setFormaPagoId] = useState('');
  const [formaPagoSeleccionada, setFormaPagoSeleccionada] = useState<FormaPago | undefined>(undefined);
  // Cambio a devolver en efectivo — mismo patrón que TurnoCajaDetalle (POS):
  // puramente de UI, nunca se manda al backend (el pago que se registra es
  // siempre por el monto exacto de la factura).
  const [montoRecibido, setMontoRecibido] = useState('');
  const [lineas, setLineas] = useState<LineaEditable[]>([LINEA_VACIA]);
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [listaPrecioOverride, setListaPrecioOverride] = useState('');
  const [descuentoGeneralTipo, setDescuentoGeneralTipo] = useState<'' | 'PCT' | 'MONTO'>('');
  const [descuentoGeneralValor, setDescuentoGeneralValor] = useState('');
  const [recargos, setRecargos] = useState<{ concepto: string; monto: string; gravado: boolean }[]>([]);
  const [moneda, setMoneda] = useState('DOP');
  const [error, setError] = useState<string | null>(null);
  // Modelo A de "más espacio para líneas" — Información arranca abierta y
  // se contrae sola en cuanto se elige un cliente, para que las líneas
  // (que pueden crecer mucho más) ganen ese espacio. Siempre se puede
  // reabrir a mano con el chevron.
  const [infoColapsada, setInfoColapsada] = useState(false);

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
    if (cliente) {
      setPlazoPagoDias(cliente.plazoPagoDias);
      setInfoColapsada(true);
    }
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
      // `confirmarGuardado` mueve la referencia de "sin cambios" al estado
      // actual — sin esto, el guard de salir sin guardar bloqueaba este
      // mismo `navigate()` con "¿Salir sin guardar?" justo después de
      // guardar bien (bug real, encontrado en vivo). El `setTimeout` deja
      // que ese re-render llegue a confirmarse antes de navegar — moverlo
      // afuera no alcanza porque `useBlocker` sigue viendo el cierre del
      // render anterior hasta que React confirma el nuevo.
      confirmarGuardado();
      setTimeout(() => navigate('/facturacion'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la factura. Revisa los datos y el stock disponible.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cliente) {
      setInfoColapsada(false);
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

  const cantidadLineas = lineas.filter((l) => l.productoId || (l.esManual && l.descripcionManual.trim())).length;

  // Estimado: para una línea de catálogo sin precio explícito, usa el
  // precio/ITBIS de lista GENERAL que trajo la búsqueda (precioReferencia/
  // itbisReferencia) — el monto real (lista del cliente, ofertas vigentes,
  // ley fiscal, prorrateo exacto del descuento) lo resuelve el backend
  // recién al guardar, por eso esto es "estimado", no el total.
  const recargosValidos = recargos.filter((r) => r.concepto.trim() && r.monto);
  const { subtotal, itbis: itbisLineas } = estimarLineas(lineas);
  const descuentoGeneral =
    descuentoGeneralTipo === 'PCT' && descuentoGeneralValor
      ? subtotal * (Number(descuentoGeneralValor) / 100)
      : descuentoGeneralTipo === 'MONTO' && descuentoGeneralValor
        ? Number(descuentoGeneralValor)
        : 0;
  // El descuento general reduce proporcionalmente la base de ITBIS de cada
  // línea (mismo efecto que el prorrateo real del backend, aproximado acá
  // escalando el ITBIS ya calculado en vez de recalcularlo línea por línea).
  const itbisLineasAjustado = subtotal > 0 ? itbisLineas * (1 - descuentoGeneral / subtotal) : 0;
  const totalRecargos = recargosValidos.reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
  const itbisRecargos = recargosValidos
    .filter((r) => r.gravado)
    .reduce((acc, r) => acc + (Number(r.monto) || 0) * (ITBIS_GENERAL_ESTIMADO / 100), 0);
  const itbisTotal = itbisLineasAjustado + itbisRecargos;
  const totalEstimado = subtotal - descuentoGeneral + itbisTotal + totalRecargos;
  const cambio = formaPagoSeleccionada?.esEfectivo && montoRecibido ? Math.max(0, Number(montoRecibido) - totalEstimado) : 0;

  // `SelectorBodega` autoselecciona sola la bodega si el tenant solo tiene
  // una — vía su propio efecto, una vez que resuelve esta misma query
  // (mismo queryKey, cache compartida con react-query, sin pedirla dos
  // veces). Sin este gate, la base de "sin cambios" se fijaba ANTES de que
  // esa autoselección llegara, y la página aparecía "sucia" apenas montada,
  // sin que el usuario tocara nada (bug real, encontrado en vivo).
  const { data: bodegas, isPending: bodegasCargando } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<BodegaBasica[]>('/inventario/bodegas')).data,
  });

  const [haycambios, confirmarGuardado] = useHayCambios(
    {
      cliente,
      bodegaId,
      tipoFactura,
      comprobanteFiscal,
      lineas,
      descuentoGeneralTipo,
      descuentoGeneralValor,
      recargos,
      formaPagoId,
      montoRecibido,
    },
    !bodegasCargando,
  );

  return (
    <PaginaDocumento
      titulo="Nueva factura"
      rutaVolver="/facturacion"
      etiquetaVolver="Volver a Facturación"
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
              {descuentoGeneral > 0 && (
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>Descuento</span>
                  <span className="font-mono tabular-nums">− RD$ {descuentoGeneral.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {totalRecargos > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Recargos</span>
                  <span className="font-mono tabular-nums">+ RD$ {totalRecargos.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>ITBIS</span>
                <span className="font-mono tabular-nums">RD$ {itbisTotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between border-t border-sol-200 pt-2 dark:border-sol-800">
              <span className="text-xs font-semibold uppercase tracking-wide text-sol-700 dark:text-sol-400">Total estimado</span>
              <span className="text-lg font-bold text-sol-800 dark:text-sol-300">
                RD$ {totalEstimado.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <span className="text-[11px] leading-snug text-sol-700/70 dark:text-sol-400/70">
              El total exacto se calcula al guardar (lista de precio del cliente, ofertas vigentes y ley fiscal del producto).
            </span>
          </div>

          {tipoFactura === 'CONTADO' && (
            <div className="flex flex-col gap-1.5 border-t border-slate-200 pt-4 dark:border-slate-800">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Forma de pago</span>
              <SelectFormaPago
                value={formaPagoId}
                onChange={(id, forma) => {
                  setFormaPagoId(id);
                  setFormaPagoSeleccionada(forma);
                  if (!forma?.esEfectivo) setMontoRecibido('');
                }}
              />
              {formaPagoSeleccionada?.esEfectivo && (
                <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Monto recibido</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="RD$"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  {montoRecibido && Number(montoRecibido) < totalEstimado && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">El monto recibido es menor al total estimado.</p>
                  )}
                  {montoRecibido && Number(montoRecibido) >= totalEstimado && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Cambio a devolver</span>
                      <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        RD$ {cambio.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5 border-t border-slate-200 pt-6 dark:border-slate-800">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Descuento general</span>
            <Select
              value={descuentoGeneralTipo}
              onChange={(e) => setDescuentoGeneralTipo(e.target.value as '' | 'PCT' | 'MONTO')}
              className="text-sm"
            >
              <option value="">Sin descuento</option>
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Recargos</span>
              <button
                type="button"
                onClick={() => setRecargos((prev) => [...prev, { concepto: '', monto: '', gravado: false }])}
                className="text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
              >
                + Agregar
              </button>
            </div>
            {recargos.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500">Ninguno</p>}
            {recargos.map((recargo, i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Concepto"
                    value={recargo.concepto}
                    onChange={(e) => setRecargos((prev) => prev.map((r, idx) => (idx === i ? { ...r, concepto: e.target.value } : r)))}
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setRecargos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    aria-label="Quitar recargo"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="RD$"
                    value={recargo.monto}
                    onChange={(e) => setRecargos((prev) => prev.map((r, idx) => (idx === i ? { ...r, monto: e.target.value } : r)))}
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={recargo.gravado}
                      onChange={(e) => setRecargos((prev) => prev.map((r, idx) => (idx === i ? { ...r, gravado: e.target.checked } : r)))}
                    />
                    Gravado
                  </label>
                </div>
              </div>
            ))}
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" form="form-nueva-factura" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear factura'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/facturacion')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-factura" onSubmit={onSubmit} className="space-y-4">
        <CardColapsable
          titulo="Información de la factura"
          colapsada={infoColapsada}
          onToggle={() => setInfoColapsada((v) => !v)}
          resumen={
            cliente
              ? `${cliente.nombre} · ${tipoFactura === 'CONTADO' ? 'Contado' : 'Crédito'} · ${ETIQUETA_COMPROBANTE[comprobanteFiscal]}${bodegaId ? ` · ${bodegas?.find((b) => b.id === bodegaId)?.nombre ?? ''}` : ''}`
              : 'Sin cliente seleccionado'
          }
        >
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
        </CardColapsable>

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
      </form>
    </PaginaDocumento>
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
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <Button type="button" variante="secundario" disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
        Crear
      </Button>
    </div>
  );
}
