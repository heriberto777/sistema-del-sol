import { TiendaOnlineConfigPanel } from '../components/organisms/TiendaOnlineConfigPanel/TiendaOnlineConfigPanel';

export function TiendaOnline() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tienda Online</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configurá el storefront público de tu catálogo.</p>
      </div>
      <TiendaOnlineConfigPanel />
    </div>
  );
}
