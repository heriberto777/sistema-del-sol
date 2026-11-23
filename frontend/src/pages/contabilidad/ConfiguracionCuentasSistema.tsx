import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { ModuloPestanas } from '../../components/templates/ModuloPestanas/ModuloPestanas';
import { Card } from '../../components/atoms/Card/Card';
import { SelectCuentaContable } from '../../components/molecules/SelectCuentaContable/SelectCuentaContable';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';

interface CuentaContableBasica {
  id: string;
  codigo: string;
  nombre: string;
}

interface FilaConfiguracion {
  clave: string;
  tipoEsperado: string;
  codigoFijo: string;
  cuentaConfigurada: CuentaContableBasica | null;
}

// docs/PLAN.md, punto 4 — etiqueta humana de cada rol (mismos nombres que
// CUENTAS_BASE en el backend, cuentas-base.ts) — CODIGOS_CUENTA es una
// constante de TypeScript, no hay catálogo en BD del que leer esto.
const ETIQUETA_ROL: Record<string, string> = {
  CAJA_BANCOS: 'Caja y Bancos',
  CUENTAS_POR_COBRAR: 'Cuentas por Cobrar',
  PROVISION_CUENTAS_INCOBRABLES: 'Provisión para Cuentas Incobrables',
  INVENTARIO: 'Inventario',
  ITBIS_ADELANTADO: 'ITBIS Adelantado (por Cobrar)',
  CUENTAS_POR_PAGAR: 'Cuentas por Pagar',
  ITBIS_POR_PAGAR: 'ITBIS por Pagar',
  TSS_ISR_POR_PAGAR: 'TSS e ISR por Pagar',
  ISR_RETENIDO_TERCEROS: 'ISR Retenido a Terceros por Pagar',
  ITBIS_RETENIDO_TERCEROS: 'ITBIS Retenido a Terceros por Pagar',
  INGRESOS_POR_VENTAS: 'Ingresos por Ventas',
  COSTO_DE_VENTAS: 'Costo de Ventas',
  GASTOS_DE_NOMINA: 'Gastos de Nómina',
  GASTO_CUENTAS_INCOBRABLES: 'Gasto por Cuentas Incobrables',
  UTILIDADES_RETENIDAS: 'Utilidades Retenidas',
};

/**
 * Override por tenant de los 15 códigos fijos que el motor de asientos
 * automáticos resuelve por rol (docs/PLAN.md, punto 4). Página propia
 * (no una pestaña de Catálogo de Cuentas — ModuloPestanas separa cada
 * pestaña real en su propia ruta) porque es una pantalla de
 * administración distinta, poco usada, igual criterio que "Formas de
 * pago" vive aparte del resto de catálogos financieros.
 */
export function ConfiguracionCuentasSistema() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contabilidad-configuracion-sistema'],
    queryFn: async () => (await apiClient.get<FilaConfiguracion[]>('/contabilidad/cuentas/configuracion-sistema')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['contabilidad-configuracion-sistema'] });
  }

  const configurar = useMutation({
    mutationFn: async ({ clave, cuentaContableId }: { clave: string; cuentaContableId: string }) =>
      apiClient.post('/contabilidad/cuentas/configuracion-sistema', { clave, cuentaContableId }),
    onSuccess: () => {
      setError(null);
      setTimeout(invalidar, 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar — revisá que la cuenta elegida sea del tipo correcto y esté activa.')),
  });

  const quitar = useMutation({
    mutationFn: async (clave: string) => apiClient.delete(`/contabilidad/cuentas/configuracion-sistema/${clave}`),
    onSuccess: () => {
      setError(null);
      setTimeout(invalidar, 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo quitar el override.')),
  });

  function onCambiarCuenta(clave: string, cuentaContableId: string) {
    if (cuentaContableId) {
      configurar.mutate({ clave, cuentaContableId });
    } else {
      quitar.mutate(clave);
    }
  }

  return (
    <ModuloPestanas
      titulo="Configuración de cuentas del sistema"
      descripcion="Reasigná qué cuenta real usa el motor de asientos automáticos para cada rol — sin elegir ninguna, se usa la cuenta fija de siempre."
      permiso="contabilidad.ver"
    >
      <Card sinPadding>
        {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
        {error && <p className="px-5 pt-5 text-sm text-red-600">{error}</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Rol del sistema</th>
                  <th className="px-5 py-3 font-medium">Código fijo</th>
                  <th className="px-5 py-3 font-medium">Cuenta a usar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((fila) => (
                  <tr key={fila.clave} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{ETIQUETA_ROL[fila.clave] ?? fila.clave}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{fila.codigoFijo}</td>
                    <td className="px-5 py-3">
                      <SelectCuentaContable
                        value={fila.cuentaConfigurada?.id ?? ''}
                        onChange={(cuentaContableId) => onCambiarCuenta(fila.clave, cuentaContableId)}
                        tipo={fila.tipoEsperado}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </ModuloPestanas>
  );
}
