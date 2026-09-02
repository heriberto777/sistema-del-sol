import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { formatearPrecio, useMisDirecciones, useTiendaConfig } from '../../hooks/useTienda';
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
 */
export function TiendaCheckout() {
  const { subdominio = '' } = useParams();
  const navigate = useNavigate();
  const carrito = useCarritoTiendaContext();
  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);
  const { cliente, token } = useClienteTienda(subdominio);
  const { data: direcciones } = useMisDirecciones(subdominio, token);

  // Con sesión, precarga los datos del perfil — igual editables, se
  // mandan igual que en modo guest (el backend no distingue el DTO).
  const [clienteNombre, setClienteNombre] = useState(cliente?.nombre ?? '');
  const [clienteTelefono, setClienteTelefono] = useState(cliente?.telefono ?? '');
  const [clienteEmail, setClienteEmail] = useState(cliente?.email ?? '');
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

  const crearPedido = useMutation({
    mutationFn: async () => {
      const { data } = await tiendaApiClient.post<{ facturaId: string }>(
        `/tienda/${subdominio}/pedidos`,
        {
          lineas: carrito.items.map((i) => ({ productoId: i.productoId, varianteId: i.varianteId, cantidad: i.cantidad })),
          clienteNombre,
          clienteTelefono,
          clienteEmail: clienteEmail || undefined,
          direccionEntrega,
          notas: notas || undefined,
        },
        // Con sesión, la Factura sale a nombre del cliente real (aparece en "Mis pedidos") — sin token, sigue siendo guest tal cual la Fase 3.
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      return data;
    },
    onSuccess: ({ facturaId }) => {
      carrito.vaciar();
      navigate(`/pagar-factura/${facturaId}`);
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
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
            <span>Total</span>
            <span>{formatearPrecio(carrito.total)}</span>
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
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="checkout-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Correo (opcional)
            </label>
            <input
              id="checkout-email"
              type="email"
              value={clienteEmail}
              onChange={(e) => setClienteEmail(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
