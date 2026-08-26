/**
 * Bloque Subtotal/Descuento/Recargos/ITBIS/Total para "ver detalle" —
 * mismo look en Factura/Cotización. `descuento`/`recargos` se omiten si
 * son 0/undefined (no todo documento los tiene).
 *
 * `subtotal` llega ya NETO de descuento (`Factura.subtotal`/
 * `Cotizacion.subtotal` — ver `calcularLineasYTotales`: cada línea
 * resta su descuento ANTES de sumarse al subtotal; `Factura.descuento`
 * es un total informativo aparte, no algo pendiente de restar). Mostrar
 * ese valor neto bajo la etiqueta "Subtotal" seguido de una fila
 * "Descuento" en negativo sugiere (a cualquier lector) que hay que
 * restarlos para llegar al Total — cosa que ya pasó, así que el cálculo
 * "Subtotal - Descuento + ITBIS" daría un número más chico y equivocado
 * (bug real reportado por el usuario: “dice que tiene un descuento pero
 * no se refleja”). Acá se reconstruye el subtotal BRUTO
 * (`subtotal + descuento`) para que la fila "Subtotal" sea el punto de
 * partida real y la resta de "Descuento" abajo sea matemáticamente
 * correcta — el Total en sí nunca cambió, solo la fila de arriba.
 */
export function BloqueTotalesDocumento({
  subtotal,
  descuento,
  recargos,
  itbis,
  total,
}: {
  subtotal: string | number;
  descuento?: string | number;
  recargos?: string | number;
  itbis: string | number;
  total: string | number;
}) {
  const fmt = (v: string | number) => `RD$ ${Number(v).toLocaleString('es-DO')}`;
  const subtotalBruto = Number(subtotal) + Number(descuento ?? 0);

  return (
    <div className="space-y-1 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
      <div className="flex justify-between text-slate-600 dark:text-slate-400">
        <span>Subtotal</span>
        <span>{fmt(subtotalBruto)}</span>
      </div>
      {!!Number(descuento) && (
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Descuento</span>
          <span>-{fmt(descuento as string | number)}</span>
        </div>
      )}
      {!!Number(recargos) && (
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Recargos</span>
          <span>{fmt(recargos as string | number)}</span>
        </div>
      )}
      <div className="flex justify-between text-slate-600 dark:text-slate-400">
        <span>ITBIS</span>
        <span>{fmt(itbis)}</span>
      </div>
      <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
        <span>Total</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
}
