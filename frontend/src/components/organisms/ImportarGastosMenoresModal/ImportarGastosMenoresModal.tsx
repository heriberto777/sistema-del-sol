import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { parsearYValidarExcelGastosMenores, FilaGastoMenorImportada } from '../../../lib/importar-gastos-menores-excel';

interface ResumenImportacionGastosMenores {
  creados: number;
  errores: { fila: number; mensaje: string }[];
}

function mensajeError(err: unknown, fallback: string): string {
  const mensaje =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
      : undefined;
  return mensaje ?? (err instanceof Error ? err.message : fallback);
}

/**
 * Fase 11.1 del benchmark (Cuadre tiene import masivo de Gastos que
 * alimenta el 606 directo) — mismo criterio que ImportarProductosModal:
 * el .xlsx se parsea y valida 100% en el navegador antes de mandar nada;
 * recién al confirmar se envía el arreglo ya validado como JSON a
 * POST /gastos-menores/importar. Una fila = un gasto con UNA sola línea
 * (el caso real del mercado informal) — no soporta gastos con varias
 * líneas ni asociarlos a un proyecto, eso sigue siendo "uno por uno"
 * desde la pantalla.
 */
export function ImportarGastosMenoresModal({ onImportado }: { onImportado: () => void }) {
  const [filas, setFilas] = useState<FilaGastoMenorImportada[] | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenImportacionGastosMenores | null>(null);

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setResumen(null);
    setErrorArchivo(null);
    setFilas(null);
    try {
      const parseadas = await parsearYValidarExcelGastosMenores(archivo);
      setFilas(parseadas);
    } catch (err) {
      setErrorArchivo(mensajeError(err, 'No se pudo leer el archivo — ¿es un .xlsx válido?'));
    }
  }

  const importar = useMutation({
    mutationFn: async () => {
      const gastos = (filas ?? []).map((f) => ({
        fecha: f.fecha,
        cuentaBancaria: f.cuentaBancaria,
        cuentaContable: f.cuentaContable,
        concepto: f.concepto,
        valor: f.valor ?? 0,
        porcentajeItbis: f.porcentajeItbis,
        cantidad: f.cantidad,
        notas: f.notas,
      }));
      return (await apiClient.post<ResumenImportacionGastosMenores>('/gastos-menores/importar', { gastos })).data;
    },
    onSuccess: (data) => {
      setResumen(data);
      onImportado();
    },
    onError: (err: unknown) => setErrorArchivo(mensajeError(err, 'No se pudo importar el archivo.')),
  });

  const filasConError = filas?.filter((f) => f.errores.length > 0) ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Subí un .xlsx con las columnas <strong>Cuenta bancaria</strong>, <strong>Cuenta contable</strong> y{' '}
        <strong>Valor</strong> (obligatorias); Fecha, Concepto, ITBIS %, Cantidad y Notas son opcionales. "Cuenta
        bancaria" acepta el nombre del banco solo (si no es ambiguo) o "Banco — NúmeroCuenta"; "Cuenta contable" acepta
        el código o el nombre de una cuenta de tipo Gasto. Cada fila crea un gasto con una sola línea — para asociarlo a
        un proyecto o cargarle varias líneas, registralo uno por uno desde "Nuevo gasto menor".
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="file"
          accept=".xlsx"
          onChange={elegirArchivo}
          className="block flex-1 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sol-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-sol-700 hover:file:bg-sol-100 dark:text-slate-300 dark:file:bg-sol-900/30 dark:file:text-sol-300"
        />
        {/* Mismo criterio que ImportarProductosModal — cada importación ya
            se graba sola en AuditLog (interceptor global); esto solo la
            hace encontrable sin tener que adivinar el filtro. */}
        <Link
          to="/auditoria/actividad?q=gastos-menores%2Fimportar"
          target="_blank"
          className="whitespace-nowrap text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
        >
          Ver importaciones anteriores →
        </Link>
      </div>

      {errorArchivo && <p className="text-sm text-red-600">{errorArchivo}</p>}

      {filas && filas.length === 0 && <p className="text-sm text-amber-700 dark:text-amber-400">El archivo no tiene ninguna fila de datos.</p>}

      {filas && filas.length > 0 && !resumen && (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {filas.length} fila(s) —{' '}
            {filasConError.length > 0 ? (
              <span className="font-medium text-red-600">{filasConError.length} con error(es), corregí el archivo y volvé a subirlo</span>
            ) : (
              <span className="font-medium text-emerald-600">todas válidas en el archivo (la cuenta bancaria/contable se confirma al importar)</span>
            )}
          </p>

          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Cuenta bancaria</th>
                  <th className="px-3 py-2 font-medium">Cuenta contable</th>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Errores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filas.map((f, i) => (
                  <tr key={i} className={f.errores.length > 0 ? 'bg-red-50 dark:bg-red-950/30' : undefined}>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.fecha ?? 'Hoy'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.cuentaBancaria || '—'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.cuentaContable || '—'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.concepto ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.valor ?? '—'}</td>
                    <td className="px-3 py-2 text-red-600">{f.errores.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button type="button" disabled={filasConError.length > 0 || importar.isPending} onClick={() => importar.mutate()}>
            {importar.isPending ? 'Importando…' : `Confirmar importación (${filas.length} fila(s))`}
          </Button>
        </>
      )}

      {resumen && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="flex gap-2">
            <Badge tono="exito">{resumen.creados} creado(s)</Badge>
            {resumen.errores.length > 0 && <Badge tono="peligro">{resumen.errores.length} error(es)</Badge>}
          </div>
          {resumen.errores.length > 0 && (
            <ul className="space-y-1 text-xs text-red-600">
              {resumen.errores.map((e, i) => (
                <li key={i}>
                  Fila {e.fila}: {e.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
