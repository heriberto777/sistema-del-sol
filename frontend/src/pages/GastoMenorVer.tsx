import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

interface CuentaBancaria {
  id: string;
  banco: string;
  numeroCuenta: string;
}

interface ProyectoOpcion {
  id: string;
  nombre: string;
}

interface LineaGastoMenorDetalle {
  id: string;
  concepto: string | null;
  valor: string;
  porcentajeItbis: string;
  montoItbis: string;
  cantidad: string;
  montoTotal: string;
  cuentaContable: CuentaContable;
}

interface GastoMenorDetalle {
  id: string;
  ncf: string | null;
  fecha: string;
  notas: string | null;
  monto: string;
  itbis: string;
  total: string;
  cuentaBancaria: CuentaBancaria;
  proyecto: ProyectoOpcion | null;
  lineas: LineaGastoMenorDetalle[];
}

/**
 * Auditoría UX (post Período Contable, 2026-11) — reemplaza a
 * `ModalVerGastoMenor` con una página real, mismo criterio que el resto
 * de "Ver detalle". Sin edición (decisión confirmada) — para corregir un
 * gasto ya cargado, se anula desde Historial de asientos y se registra
 * de nuevo.
 */
export function GastoMenorVer() {
  const { id = '' } = useParams<{ id: string }>();

  const { data } = useQuery({
    queryKey: ['gasto-menor', id],
    queryFn: async () => (await apiClient.get<GastoMenorDetalle>(`/gastos-menores/${id}`)).data,
  });

  return (
    <PaginaDocumento
      titulo={data ? `Gasto menor — ${data.ncf ?? new Date(data.fecha).toLocaleDateString('es-DO')}` : 'Gasto menor'}
      rutaVolver="/gastos-menores"
      etiquetaVolver="Volver a Gastos menores"
      haycambios={false}
      resumen={
        !data ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : (
          <>
            {data.ncf && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">NCF</span>
                <span className="font-mono text-sm text-slate-900 dark:text-slate-100">{data.ncf}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</span>
              <span className="text-sm text-slate-700 dark:text-slate-300">{new Date(data.fecha).toLocaleDateString('es-DO')}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cuenta bancaria</span>
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {data.cuentaBancaria.banco} — {data.cuentaBancaria.numeroCuenta}
              </span>
            </div>
            {data.proyecto && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Proyecto</span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{data.proyecto.nombre}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {Number(data.total).toLocaleString('es-DO')}</span>
            </div>
          </>
        )
      }
      acciones={<></>}
    >
      {!data ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
      ) : (
        <>
          {data.notas && (
            <Card titulo="Notas">
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{data.notas}</p>
            </Card>
          )}
          <Card titulo="Cuentas contables">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Cuenta contable</th>
                    <th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2">Cant.</th>
                    <th className="px-3 py-2">Valor</th>
                    <th className="px-3 py-2">ITBIS</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.lineas.map((linea) => (
                    <tr key={linea.id}>
                      <td className="px-3 py-2">
                        {linea.cuentaContable.codigo} — {linea.cuentaContable.nombre}
                      </td>
                      <td className="px-3 py-2">{linea.concepto ?? '—'}</td>
                      <td className="px-3 py-2">{Number(linea.cantidad)}</td>
                      <td className="px-3 py-2">RD$ {Number(linea.valor).toLocaleString('es-DO')}</td>
                      <td className="px-3 py-2">RD$ {Number(linea.montoItbis).toLocaleString('es-DO')}</td>
                      <td className="px-3 py-2">RD$ {Number(linea.montoTotal).toLocaleString('es-DO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </PaginaDocumento>
  );
}
