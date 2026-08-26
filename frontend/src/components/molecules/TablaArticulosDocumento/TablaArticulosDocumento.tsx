interface LineaArticulo {
  producto?: { nombre: string } | null;
  descripcionManual?: string | null;
  cantidad: string | number;
  precioUnitario?: string | number;
  montoTotal?: string | number;
}

/**
 * Tabla de líneas para "ver detalle" (Factura/Cotización/Remisión) —
 * mismo fallback `producto?.nombre ?? descripcionManual` ya establecido
 * en `mapear-factura-pdf.ts`/`mapear-cotizacion-pdf.ts` (ítem B-9, línea
 * manual/libre). `mostrarPrecios=false` (Remisión, que no factura) oculta
 * Precio/Total — solo Descripción/Cantidad.
 */
export function TablaArticulosDocumento({ lineas, mostrarPrecios = true }: { lineas: LineaArticulo[]; mostrarPrecios?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
          <tr>
            <th className="px-4 py-2 font-medium">Descripción</th>
            <th className="px-4 py-2 text-right font-medium">Cant</th>
            {mostrarPrecios && (
              <>
                <th className="px-4 py-2 text-right font-medium">Precio</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {lineas.map((linea, i) => (
            <tr key={i}>
              <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{linea.producto?.nombre ?? linea.descripcionManual}</td>
              <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">{linea.cantidad}</td>
              {mostrarPrecios && (
                <>
                  <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">
                    RD$ {Number(linea.precioUnitario ?? 0).toLocaleString('es-DO')}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                    RD$ {Number(linea.montoTotal ?? 0).toLocaleString('es-DO')}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
