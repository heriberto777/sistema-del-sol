import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Detecta si `estado` cambió desde que `listo` pasó a ser `true` — usado
 * para el guard de "salir sin guardar" en las páginas de documento
 * (Factura/Cotización/Remisión). En un formulario de "crear", `listo` es
 * `true` desde el montaje. En uno de "editar", el formulario arranca con
 * `valores: null` mientras carga el detalle — pasar `listo={valores !==
 * null}` captura como referencia el primer estado ya prellenado con los
 * datos reales, no el `null` inicial.
 *
 * La captura se difiere un macrotask (`setTimeout(0)`) en vez de tomarse
 * en el mismo render — varios campos se auto-completan solos apenas
 * montan (bodega única en `SelectorBodega`, variante única en
 * `SelectorLineaProducto`) vía su propio `useEffect`, que corre DESPUÉS
 * del render inicial y encima depende de una consulta de red propia (ver
 * `bodegasCargando` en FacturacionNueva) — no alcanza con esperar un solo
 * ciclo de render. Capturar la referencia de inmediato marcaba ese
 * auto-completado como "cambio del usuario" y disparaba el guard en una
 * página recién abierta, sin que nadie hubiera tocado nada (bug real,
 * encontrado en vivo).
 *
 * Devuelve `[hayCambios, confirmarGuardado]` — llamar a `confirmarGuardado`
 * al terminar de guardar (antes de navegar afuera) mueve la referencia al
 * estado actual, para que el propio `navigate()` del `onSuccess` no quede
 * bloqueado por su guard (otro bug real: sin esto, "Crear factura" guardaba
 * bien pero mostraba "¿Salir sin guardar?" al redirigir a la lista).
 */
export function useHayCambios<T>(estado: T, listo = true): [boolean, () => void] {
  const inicialRef = useRef<string | null>(null);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const [, forzarRecalculo] = useState(0);

  useEffect(() => {
    if (!listo || inicialRef.current !== null) return;
    const id = setTimeout(() => {
      inicialRef.current = JSON.stringify(estadoRef.current);
      forzarRecalculo((n) => n + 1);
    }, 0);
    return () => clearTimeout(id);
  }, [listo]);

  const confirmarGuardado = useCallback(() => {
    inicialRef.current = JSON.stringify(estadoRef.current);
    forzarRecalculo((n) => n + 1);
  }, []);

  const hayCambios = inicialRef.current !== null && JSON.stringify(estado) !== inicialRef.current;
  return [hayCambios, confirmarGuardado];
}
