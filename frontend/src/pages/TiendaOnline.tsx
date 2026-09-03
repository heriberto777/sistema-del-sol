import { useState } from 'react';
import clsx from 'clsx';
import { TiendaOnlineConfigPanel } from '../components/organisms/TiendaOnlineConfigPanel/TiendaOnlineConfigPanel';
import { PedidosTiendaPanel } from '../components/organisms/PedidosTiendaPanel/PedidosTiendaPanel';
import { SeccionesTiendaPanel } from '../components/organisms/SeccionesTiendaPanel/SeccionesTiendaPanel';

const PESTANAS = [
  { id: 'configuracion', etiqueta: 'Configuración' },
  { id: 'secciones', etiqueta: 'Secciones del Home' },
  { id: 'pedidos', etiqueta: 'Pedidos' },
] as const;

export function TiendaOnline() {
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]['id']>('configuracion');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tienda Online</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configurá el storefront público de tu catálogo y revisá los pedidos.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {PESTANAS.map((p) => (
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

      {pestana === 'configuracion' && <TiendaOnlineConfigPanel />}
      {pestana === 'secciones' && <SeccionesTiendaPanel />}
      {pestana === 'pedidos' && <PedidosTiendaPanel />}
    </div>
  );
}
