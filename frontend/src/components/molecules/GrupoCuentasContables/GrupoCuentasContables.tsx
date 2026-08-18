interface SaldoCuenta {
  codigo: string;
  nombre: string;
  saldo: number;
}

function formatoRD(valor: number) {
  return `RD$ ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

/** Compartido por EstadoResultadosView y BalanceGeneralView — mismo bloque "grupo de cuentas con su total" en ambos reportes. */
export function GrupoCuentasContables({
  titulo,
  grupo,
  descripcionVacio = 'Sin movimientos',
}: {
  titulo: string;
  grupo: { cuentas: SaldoCuenta[]; total: number };
  descripcionVacio?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-2 font-medium text-slate-900 dark:text-slate-100">{titulo}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {grupo.cuentas.map((cuenta) => (
              <tr key={cuenta.codigo}>
                <td className="py-1 text-slate-600 dark:text-slate-400">
                  {cuenta.codigo} — {cuenta.nombre}
                </td>
                <td className="py-1 text-right">{formatoRD(cuenta.saldo)}</td>
              </tr>
            ))}
            {grupo.cuentas.length === 0 && (
              <tr>
                <td className="py-1 text-slate-400" colSpan={2}>
                  {descripcionVacio}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-medium dark:border-slate-800">
              <td className="py-1">Total</td>
              <td className="py-1 text-right">{formatoRD(grupo.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
