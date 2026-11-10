import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Card } from '../components/atoms/Card/Card';
import { useAuth } from '../hooks/useAuth';
import { esVisible } from '../config/menu-erp';
import { CONFIGURACION_HUB } from '../config/configuracion-hub';

export function Configuracion() {
  const { tienePermiso, tieneModulo } = useAuth();

  const categorias = CONFIGURACION_HUB.map((cat) => ({
    ...cat,
    items: cat.items.filter((item) => esVisible(item, tienePermiso, tieneModulo)),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Configuración</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Todo lo que ajusta cómo funciona tu negocio en el sistema, agrupado por tema.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categorias.map((cat) => {
          const Icono = cat.icono;
          return (
            <Card key={cat.id} className="h-full" contentClassName="space-y-1" sinPadding={false}>
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sol-50 text-sol-600 dark:bg-sol-900 dark:text-sol-300">
                  <Icono size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cat.etiqueta}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{cat.descripcion}</p>
                </div>
              </div>
              <ul className="space-y-0.5">
                {cat.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.ruta}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-sol-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sol-400"
                    >
                      <span className="truncate">{item.etiqueta}</span>
                      <ChevronRight size={14} className="shrink-0 text-slate-300 dark:text-slate-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {categorias.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">No tenés acceso a ninguna pantalla de configuración todavía.</p>
      )}
    </div>
  );
}
