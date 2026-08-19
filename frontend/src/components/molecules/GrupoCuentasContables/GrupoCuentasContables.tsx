import { Card } from '../../atoms/Card/Card';

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
    <Card titulo={titulo} sinPadding>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {grupo.cuentas.map((cuenta) => (
              <tr key={cuenta.codigo} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-2 text-slate-600 dark:text-slate-400">
                  {cuenta.codigo} — {cuenta.nombre}
                </td>
                <td className="px-5 py-2 text-right">{formatoRD(cuenta.saldo)}</td>
              </tr>
            ))}
            {grupo.cuentas.length === 0 && (
              <tr>
                <td className="px-5 py-2 text-slate-400" colSpan={2}>
                  {descripcionVacio}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-medium dark:border-slate-800">
              <td className="px-5 py-2">Total</td>
              <td className="px-5 py-2 text-right">{formatoRD(grupo.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
