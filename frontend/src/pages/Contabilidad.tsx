import { useState } from 'react';
import clsx from 'clsx';
import { CuentasContablesTable } from '../components/organisms/CuentasContablesTable/CuentasContablesTable';
import { AsientosContablesTable } from '../components/organisms/AsientosContablesTable/AsientosContablesTable';
import { GastoRapidoForm } from '../components/organisms/GastoRapidoForm/GastoRapidoForm';
import { BalanceGeneralView } from '../components/organisms/BalanceGeneralView/BalanceGeneralView';
import { EstadoResultadosView } from '../components/organisms/EstadoResultadosView/EstadoResultadosView';
import { BalanceComprobacionView } from '../components/organisms/BalanceComprobacionView/BalanceComprobacionView';
import { LibroMayorView } from '../components/organisms/LibroMayorView/LibroMayorView';
import { CierrePeriodoView } from '../components/organisms/CierrePeriodoView/CierrePeriodoView';
import { ConciliacionBancariaView } from '../components/organisms/ConciliacionBancariaView/ConciliacionBancariaView';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';

const PESTANAS = [
  { id: 'cuentas', etiqueta: 'Catálogo de cuentas' },
  { id: 'asientos', etiqueta: 'Asientos' },
  { id: 'gastos', etiqueta: 'Nuevo gasto', permiso: 'contabilidad.editar' },
  { id: 'balance', etiqueta: 'Balance general' },
  { id: 'resultados', etiqueta: 'Estado de resultados' },
  { id: 'comprobacion', etiqueta: 'Balance de comprobación' },
  { id: 'libro-mayor', etiqueta: 'Libro mayor' },
  { id: 'conciliacion', etiqueta: 'Conciliación bancaria' },
  { id: 'cierre', etiqueta: 'Cierre de período' },
] as const;

type PestanaId = (typeof PESTANAS)[number]['id'];

export function Contabilidad() {
  const { tienePermiso } = useAuth();
  const [pestana, setPestana] = useState<PestanaId>('cuentas');
  const pestanasVisibles = PESTANAS.filter((p) => !('permiso' in p) || tienePermiso(p.permiso));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Contabilidad</h1>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {pestanasVisibles.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={clsx(
              'border-b-2 px-3 py-2 text-sm font-medium',
              pestana === p.id
                ? 'border-sol-500 text-sol-600 dark:text-sol-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400',
            )}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <RequierePermiso permiso="contabilidad.ver">
        {pestana === 'cuentas' && <CuentasContablesTable />}
        {pestana === 'asientos' && <AsientosContablesTable />}
        {pestana === 'gastos' && <GastoRapidoForm />}
        {pestana === 'balance' && <BalanceGeneralView />}
        {pestana === 'resultados' && <EstadoResultadosView />}
        {pestana === 'comprobacion' && <BalanceComprobacionView />}
        {pestana === 'libro-mayor' && <LibroMayorView />}
        {pestana === 'conciliacion' && <ConciliacionBancariaView />}
        {pestana === 'cierre' && <CierrePeriodoView />}
      </RequierePermiso>
    </div>
  );
}
