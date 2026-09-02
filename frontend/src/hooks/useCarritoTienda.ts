import { useCallback, useState } from 'react';

export interface ItemCarritoTienda {
  productoId: string;
  varianteId: string;
  nombre: string;
  /** Ej. "Talla: M, Color: Rojo" — vacío si el producto nunca usó atributos. */
  varianteEtiqueta: string;
  precio: number;
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

/**
 * Carrito 100% del lado del cliente (localStorage, por subdominio) —
 * conveniencia de recarga, no fuente de verdad: crear el pedido (Fase 3)
 * revalida stock/precio contra el catálogo real, nunca confía en lo que
 * haya guardado el navegador. Cada línea se identifica por `varianteId`
 * (Fase 4) — ya identifica sin ambigüedad producto+variante, así que no
 * hace falta una clave compuesta con `productoId`.
 *
 * Escribe en localStorage de forma incondicional ANTES de llamar a
 * `setState`, nunca dentro del *updater* funcional de `setState` ni en
 * un `useEffect` reactivo a `items` — un `vaciar()` seguido de inmediato
 * por un `navigate()` (el caso real de `TiendaCheckout` al confirmar un
 * pedido) puede desmontar este hook antes de que React llegue a
 * ejecutar ese updater o efecto (bug real, encontrado en la
 * verificación en vivo de la Fase 3: el carrito no se vaciaba tras
 * crear el pedido, ni con la persistencia por `useEffect` original ni
 * con un primer intento de escribir dentro del *updater*). Como cada
 * mutador captura `items` directo del cierre de este render (sin la
 * forma funcional de `setState`), estos mutadores deben recrearse en
 * cada render — de ahí `items` en las dependencias de `useCallback` en
 * vez de memoizarlos una sola vez.
 */
export function useCarritoTienda(subdominio: string) {
  const [items, setItems] = useState<ItemCarritoTienda[]>(() => leer(subdominio));

  const agregar = useCallback(
    (item: Omit<ItemCarritoTienda, 'cantidad'>, cantidad = 1) => {
      const existente = items.find((i) => i.varianteId === item.varianteId);
      const siguiente = existente
        ? items.map((i) => (i.varianteId === item.varianteId ? { ...i, cantidad: i.cantidad + cantidad } : i))
        : [...items, { ...item, cantidad }];
      escribir(subdominio, siguiente);
      setItems(siguiente);
    },
    [subdominio, items],
  );

  const actualizarCantidad = useCallback(
    (varianteId: string, cantidad: number) => {
      const siguiente =
        cantidad <= 0 ? items.filter((i) => i.varianteId !== varianteId) : items.map((i) => (i.varianteId === varianteId ? { ...i, cantidad } : i));
      escribir(subdominio, siguiente);
      setItems(siguiente);
    },
    [subdominio, items],
  );

  const quitar = useCallback(
    (varianteId: string) => {
      const siguiente = items.filter((i) => i.varianteId !== varianteId);
      escribir(subdominio, siguiente);
      setItems(siguiente);
    },
    [subdominio, items],
  );

  const vaciar = useCallback(() => {
    escribir(subdominio, []);
    setItems([]);
  }, [subdominio]);

  const cantidadTotal = items.reduce((acc, i) => acc + i.cantidad, 0);
  const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);

  return { items, agregar, actualizarCantidad, quitar, vaciar, cantidadTotal, total };
}

export type CarritoTienda = ReturnType<typeof useCarritoTienda>;
