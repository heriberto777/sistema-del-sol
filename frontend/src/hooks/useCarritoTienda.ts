import { useCallback, useEffect, useState } from 'react';

export interface ItemCarritoTienda {
  productoId: string;
  nombre: string;
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

/**
 * Carrito 100% del lado del cliente (localStorage, por subdominio) —
 * conveniencia de recarga, no fuente de verdad: crear el pedido (Fase 3)
 * revalida stock/precio contra el catálogo real, nunca confía en lo que
 * haya guardado el navegador.
 */
export function useCarritoTienda(subdominio: string) {
  const [items, setItems] = useState<ItemCarritoTienda[]>(() => leer(subdominio));

  useEffect(() => {
    localStorage.setItem(claveStorage(subdominio), JSON.stringify(items));
  }, [subdominio, items]);

  const agregar = useCallback((item: Omit<ItemCarritoTienda, 'cantidad'>, cantidad = 1) => {
    setItems((actual) => {
      const existente = actual.find((i) => i.productoId === item.productoId);
      if (existente) {
        return actual.map((i) => (i.productoId === item.productoId ? { ...i, cantidad: i.cantidad + cantidad } : i));
      }
      return [...actual, { ...item, cantidad }];
    });
  }, []);

  const actualizarCantidad = useCallback((productoId: string, cantidad: number) => {
    setItems((actual) =>
      cantidad <= 0
        ? actual.filter((i) => i.productoId !== productoId)
        : actual.map((i) => (i.productoId === productoId ? { ...i, cantidad } : i)),
    );
  }, []);

  const quitar = useCallback((productoId: string) => {
    setItems((actual) => actual.filter((i) => i.productoId !== productoId));
  }, []);

  const vaciar = useCallback(() => setItems([]), []);

  const cantidadTotal = items.reduce((acc, i) => acc + i.cantidad, 0);
  const total = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);

  return { items, agregar, actualizarCantidad, quitar, vaciar, cantidadTotal, total };
}

export type CarritoTienda = ReturnType<typeof useCarritoTienda>;
