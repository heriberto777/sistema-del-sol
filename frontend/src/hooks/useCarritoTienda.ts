import { useCallback, useEffect, useRef, useState } from 'react';
import { tiendaApiClient } from '../lib/tienda-api-client';

export interface ItemCarritoTienda {
  productoId: string;
  varianteId: string;
  nombre: string;
  /** Ej. "Talla: M, Color: Rojo" — vacío si el producto nunca usó atributos. */
  varianteEtiqueta: string;
  /** Precio ya con descuento aplicado si el producto tenía una oferta al momento de agregarlo (ver `precioParaCarrito`) — es el que realmente se cobra. */
  precio: number;
  /** Fase 16 — precio de lista ANTES del descuento, solo presente si hubo oferta al agregar. Puramente informativo (mostrar tachado en el carrito); nunca se usa para calcular el total. */
  precioOriginal?: number;
  imagen: string | null;
  cantidad: number;
}

function claveStorage(subdominio: string): string {
  return `sol_carrito_tienda_${subdominio}`;
}

function leer(subdominio: string): ItemCarritoTienda[] {
  try {
    const raw = localStorage.getItem(claveStorage(subdominio));
    return raw ? (JSON.parse(raw) as ItemCarritoTienda[]) : [];
  } catch {
    return [];
  }
}

function escribir(subdominio: string, items: ItemCarritoTienda[]) {
  try {
    localStorage.setItem(claveStorage(subdominio), JSON.stringify(items));
  } catch {
    // localStorage lleno/deshabilitado — el carrito sigue funcionando en memoria para esta sesión.
  }
}

/** Suma cantidades de las variantes que están en ambos carritos, agrega las que solo están en uno — nunca se pierde una línea de ninguno de los dos lados. */
function combinarCarritos(local: ItemCarritoTienda[], remoto: ItemCarritoTienda[]): ItemCarritoTienda[] {
  const resultado = [...local];
  for (const item of remoto) {
    const i = resultado.findIndex((x) => x.varianteId === item.varianteId);
    if (i >= 0) resultado[i] = { ...resultado[i], cantidad: resultado[i].cantidad + item.cantidad };
    else resultado.push(item);
  }
  return resultado;
}

/** Fire-and-forget — un fallo de red/token vencido no debe romper la compra, el carrito ya quedó bien en localStorage; se reintenta solo en la próxima mutación. */
function sincronizarServidor(subdominio: string, token: string | null, items: ItemCarritoTienda[]) {
  if (!token) return;
  tiendaApiClient.put(`/tienda/${subdominio}/mi-carrito`, { items }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}

/**
 * Carrito del lado del cliente (localStorage, por subdominio) — sigue
 * siendo la fuente de verdad LOCAL (conveniencia de recarga, nunca del
 * pedido: crear el pedido, Fase 3, revalida stock/precio contra el
 * catálogo real). Cada línea se identifica por `varianteId` (Fase 4).
 *
 * Fase 16 — si `token` (sesión de cliente logueado, ver `useClienteTienda`)
 * está presente, además se sincroniza con `CarritoClienteTienda` en la
 * base de datos: al iniciar sesión se trae el carrito guardado y se
 * FUSIONA con el local (nunca se descarta ninguno de los dos lados —
 * `combinarCarritos`), y cada mutación posterior se re-sube. Cerrar
 * sesión NO borra el carrito local — sigue funcionando como guest.
 *
 * Escribe en localStorage de forma incondicional ANTES de llamar a
 * `setState`, nunca dentro del *updater* funcional de `setState` ni en
 * un `useEffect` reactivo a `items` — un `vaciar()` seguido de inmediato
 * por un `navigate()` (el caso real de `TiendaCheckout` al confirmar un
 * pedido) puede desmontar este hook antes de que React llegue a
 * ejecutar ese updater o efecto (bug real, encontrado en la
 * verificación en vivo de la Fase 3). El `PUT` de sincronización es
 * fire-and-forget fuera del ciclo de React, así que no lo afecta ese
 * mismo problema. Como cada mutador captura `items` directo del cierre
 * de este render, deben recrearse en cada render — de ahí `items` en
 * las dependencias de `useCallback` en vez de memoizarlos una sola vez.
 */
export function useCarritoTienda(subdominio: string, token: string | null = null) {
  const [items, setItems] = useState<ItemCarritoTienda[]>(() => leer(subdominio));
  const yaFusionoEsteToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token || yaFusionoEsteToken.current === token) return;
    yaFusionoEsteToken.current = token;
    (async () => {
      try {
        const { data } = await tiendaApiClient.get<{ items: ItemCarritoTienda[] }>(`/tienda/${subdominio}/mi-carrito`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems((actual) => {
          const combinado = combinarCarritos(actual, data.items ?? []);
          escribir(subdominio, combinado);
          sincronizarServidor(subdominio, token, combinado);
          return combinado;
        });
      } catch {
        // sin conexión o token inválido/vencido — el carrito local sigue funcionando igual, se reintenta en el próximo login.
      }
    })();
  }, [subdominio, token]);

  const agregar = useCallback(
    (item: Omit<ItemCarritoTienda, 'cantidad'>, cantidad = 1) => {
      const existente = items.find((i) => i.varianteId === item.varianteId);
      // Al fusionar, prevalecen los datos NUEVOS (precio/precioOriginal pueden haber cambiado — ej. una oferta que arrancó después del primer agregado) — solo la cantidad se acumula sobre la ya existente.
      const siguiente = existente
        ? items.map((i) => (i.varianteId === item.varianteId ? { ...item, cantidad: i.cantidad + cantidad } : i))
        : [...items, { ...item, cantidad }];
      escribir(subdominio, siguiente);
      setItems(siguiente);
      sincronizarServidor(subdominio, token, siguiente);
    },
    [subdominio, items, token],
  );

  const actualizarCantidad = useCallback(
    (varianteId: string, cantidad: number) => {
      const siguiente =
        cantidad <= 0 ? items.filter((i) => i.varianteId !== varianteId) : items.map((i) => (i.varianteId === varianteId ? { ...i, cantidad } : i));
      escribir(subdominio, siguiente);
      setItems(siguiente);
      sincronizarServidor(subdominio, token, siguiente);
    },
    [subdominio, items, token],
  );

  const quitar = useCallback(
    (varianteId: string) => {
      const siguiente = items.filter((i) => i.varianteId !== varianteId);
      escribir(subdominio, siguiente);
      setItems(siguiente);
      sincronizarServidor(subdominio, token, siguiente);
    },
    [subdominio, items, token],
  );

  const vaciar = useCallback(() => {
    escribir(subdominio, []);
    setItems([]);
    sincronizarServidor(subdominio, token, []);
  }, [subdominio, token]);

  const cantidadTotal = items.reduce((acc, i) => acc + i.cantidad, 0);
  const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);

  return { items, agregar, actualizarCantidad, quitar, vaciar, cantidadTotal, total };
}

export type CarritoTienda = ReturnType<typeof useCarritoTienda>;
