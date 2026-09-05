import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { formatearPrecio, usePreviewPedido, useMiPerfil, useMisDirecciones, useTiendaConfig } from '../../hooks/useTienda';
import { tiendaApiClient } from '../../lib/tienda-api-client';
import { useCarritoTiendaContext } from './CarritoTiendaContext';
import { useClienteTienda } from '../../hooks/useClienteTienda';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

/**
 * Formulario de checkout — deliberadamente genérico (no una piel más por
 * plantilla): es un paso transaccional, no de marca. Al confirmar, crea
 * el pedido (`POST /tienda/:subdominio/pedidos`, revalida stock/precio
 * server-side) y redirige al checkout público YA existente
 * (`/pagar-factura/:facturaId`) — esta página no cobra nada.
 *
 * Pedido explícito: agregar al carrito sigue sin pedir nada, pero
 * finalizar la compra exige cuenta — si no hay sesión, esta página
 * muestra un gate (login/crear cuenta) en vez del formulario. El
 * backend (`crear-pedido-tienda.dto.ts`) sigue aceptando guest tal cual
 * (no se le sacó esa capacidad), el gate es solo de este lado.
 */
export function TiendaCheckout() {
  const subdominio = useSubdominioTienda();
  const navigate = useNavigate();
  const location = useLocation();
  const carrito = useCarritoTiendaContext();
  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);
  const { cliente, token, autenticado } = useClienteTienda(subdominio);
  const { data: direcciones } = useMisDirecciones(subdominio, token);
  const { data: perfil } = useMiPerfil(subdominio, token);
  // El precio de catálogo que ve toda la tienda es SIN ITBIS — sumarlo acá
  // a mano duplicaría exenciones/leyFiscal/ofertas por producto que solo
  // el backend conoce, y podía desalinearse del total real de la Factura
  // (bug reportado: el total del checkout no coincidía con el cobrado).
  const previewPedido = usePreviewPedido(
    subdominio,
    carrito.items.map((i) => ({ productoId: i.productoId, varianteId: i.varianteId, cantidad: i.cantidad })),
    token,
  );

  // Con sesión, precarga los datos del perfil — igual editables, se
  // mandan igual que en modo guest (el backend no distingue el DTO).
  const [clienteNombre, setClienteNombre] = useState(cliente?.nombre ?? '');
  const [clienteTelefono, setClienteTelefono] = useState(cliente?.telefono ?? '');
  const [clienteEmail, setClienteEmail] = useState(cliente?.email ?? '');
  // Ítem "documento fiscal del comprador" — pedido explícito, obligatorio.
  // `cliente` (la sesión, sin rncCedula) no lo trae — se precarga aparte
  // desde `useMiPerfil` (el perfil completo) apenas carga, igual criterio
  // que `direcciones` más abajo. Si ya lo cargó antes (queda guardado en
  // su Cliente real, ver EcommerceService.crearPedido), no hay que
  // pedirlo de nuevo.
  const [clienteDocumento, setClienteDocumento] = useState('');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [notas, setNotas] = useState('');

  // Fase 10 — si tiene direcciones guardadas, autocompleta con la
  // principal (sigue editable después) sin bloquear al guest ni al
  // cliente que todavía no guardó ninguna.
  useEffect(() => {
    if (!direcciones?.length || direccionEntrega) return;
    const principal = direcciones.find((d) => d.esPrincipal) ?? direcciones[0];
    setDireccionEntrega(principal.direccion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direcciones]);

  useEffect(() => {
    if (!perfil?.rncCedula || clienteDocumento) return;
    setClienteDocumento(perfil.rncCedula);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil]);

  const crearPedido = useMutation({
    mutationFn: async () => {
      const { data } = await tiendaApiClient.post<{ facturaId: string }>(
        `/tienda/${subdominio}/pedidos`,
        {
          lineas: carrito.items.map((i) => ({ productoId: i.productoId, varianteId: i.varianteId, cantidad: i.cantidad })),
          clienteNombre,
          clienteTelefono,
          clienteEmail,
          clienteDocumento,
          direccionEntrega,
          notas: notas || undefined,
        },
        // El gate de abajo (!autenticado) ya garantiza que siempre hay token acá — la Factura sale a nombre del cliente real (aparece en "Mis pedidos").
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      return data;
    },
    onSuccess: ({ facturaId }) => {
      carrito.vaciar();
      // `tienda` en la URL es lo que le permite a esa página (genérica,
      // compartida con cualquier link de cobro de tenant, ver
      // CobroFactura.tsx) mostrar "Volver a la tienda"/"Mis pedidos" sin
      // asumir que TODO pago público viene de acá.
      navigate(`/pagar-factura/${facturaId}?tienda=${subdominio}`);
    },
  });

  if (isLoading) return <TiendaCargando />;
  if (isError || !config) return <TiendaNoEncontrada />;

  if (carrito.items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 px-6 text-center dark:bg-slate-950">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tu carrito está vacío</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Agregá productos antes de finalizar la compra.</p>
      </div>
    );
  }

  // Pedido explícito: para finalizar la compra hace falta cuenta — el
  // carrito NO se toca acá (sigue en localStorage, keyed solo por
  // subdominio — ver useCarritoTienda) y `useClienteTienda` ya fusiona
  // automáticamente el carrito guest con el del servidor apenas hay
  // token, sin importar en qué página ocurrió el login (pub/sub propio,
  // ver notificarCambioSesion) — así que volver acá después de loguearse
  // muestra el mismo carrito, sin ningún manejo especial de más.
  if (!autenticado) {
    const destino = { pathname: location.pathname, search: location.search };
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 py-10 dark:bg-slate-950">
        <div className="w-full max-w-sm text-center">
          <Link
            to={`/tienda/${subdominio}`}
            className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ‹ Seguir comprando
          </Link>
          <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Iniciá sesión para continuar</h1>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            Tu carrito ({carrito.items.length} {carrito.items.length === 1 ? 'producto' : 'productos'}) sigue guardado — inicia sesión o creá una
            cuenta para finalizar la compra.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to={`/tienda/${subdominio}/login`}
              state={{ from: destino }}
              className="rounded-lg bg-sol-500 px-6 py-3 text-sm font-semibold text-white hover:bg-sol-600"
            >
              Iniciar sesión
            </Link>
            <Link
              to={`/tienda/${subdominio}/registro`}
              state={{ from: destino }}
              className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crearPedido.mutate();
  }

  const mensajeError = isAxiosError(crearPedido.error)
    ? ((crearPedido.error.response?.data as { message?: string } | undefined)?.message ?? 'No se pudo crear el pedido.')
    : crearPedido.isError
      ? 'No se pudo crear el pedido.'
      : null;

  return (
    <div className="min-h-screen bg-slate-50 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-lg px-6">
        <Link
          to={`/tienda/${subdominio}`}
          className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ‹ Seguir comprando
        </Link>
        <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Finalizar compra</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{config.nombre}</p>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {carrito.items.map((item) => (
            <div key={item.varianteId} className="flex justify-between py-1 text-sm">
              <span className="text-slate-700 dark:text-slate-300">
                {item.cantidad} × {item.nombre}
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{formatearPrecio(item.precio * item.cantidad)}</span>
            </div>
          ))}
          <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
            {previewPedido.isLoading ? (
              <p className="text-slate-500 dark:text-slate-400">Calculando ITBIS…</p>
            ) : previewPedido.data ? (
              <>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatearPrecio(previewPedido.data.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>ITBIS</span>
                  <span>{formatearPrecio(previewPedido.data.itbis)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100">
                  <span>Total</span>
                  <span>{formatearPrecio(previewPedido.data.total)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100">
                <span>Total (ITBIS incluido)</span>
                <span>{formatearPrecio(carrito.total)}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="checkout-nombre" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre completo
            </label>
            <input
              id="checkout-nombre"
              required
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="checkout-telefono" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Teléfono
            </label>
            <input
              id="checkout-telefono"
              required
              value={clienteTelefono}
              onChange={(e) => setClienteTelefono(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="checkout-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Correo
            </label>
            <input
              id="checkout-email"
              type="email"
              required
              value={clienteEmail}
              onChange={(e) => setClienteEmail(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="checkout-documento" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              RNC o Cédula
            </label>
            <input
              id="checkout-documento"
              required
              value={clienteDocumento}
              onChange={(e) => setClienteDocumento(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">Necesario para tu comprobante.</span>
          </div>

          {!!direcciones?.length && (
            <div className="flex flex-col gap-1">
              <label htmlFor="checkout-direccion-guardada" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Dirección guardada
              </label>
              <select
                id="checkout-direccion-guardada"
                defaultValue=""
                onChange={(e) => {
                  const elegida = direcciones.find((d) => d.id === e.target.value);
                  if (elegida) setDireccionEntrega(elegida.direccion);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="" disabled>
                  Elegí una dirección guardada o escribí una nueva abajo
                </option>
                {direcciones.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.direccion}
                    {d.esPrincipal ? ' (principal)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="checkout-direccion" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Dirección de entrega
            </label>
            <textarea
              id="checkout-direccion"
              required
              rows={2}
              value={direccionEntrega}
              onChange={(e) => setDireccionEntrega(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="checkout-notas" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Notas (opcional)
            </label>
            <textarea
              id="checkout-notas"
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {mensajeError && <p className="text-sm text-red-600 dark:text-red-400">{mensajeError}</p>}

          <button
            type="submit"
            disabled={crearPedido.isPending}
            className="rounded-lg bg-sol-500 px-6 py-3 text-sm font-semibold text-white hover:bg-sol-600 disabled:opacity-60"
          >
            {crearPedido.isPending ? 'Creando pedido…' : 'Confirmar pedido y pagar'}
          </button>
        </form>
      </div>
    </div>
  );
}
