/**
 * Bloque Subtotal/Descuento/Recargos/ITBIS/Total para "ver detalle" —
 * mismo look en Factura/Cotización. `descuento`/`recargos` se omiten si
 * son 0/undefined (no todo documento los tiene).
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

  return (
    <div className="space-y-1 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
      <div className="flex justify-between text-slate-600 dark:text-slate-400">
        <span>Subtotal</span>
        <span>{fmt(subtotal)}</span>
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
