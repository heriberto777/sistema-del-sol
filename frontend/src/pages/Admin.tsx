import { useState } from 'react';
import clsx from 'clsx';
import { UsuariosPanel } from '../components/organisms/UsuariosPanel/UsuariosPanel';
import { RolesPanel } from '../components/organisms/RolesPanel/RolesPanel';
import { WebhooksPanel } from '../components/organisms/WebhooksPanel/WebhooksPanel';
import { ConfiguracionesPanel } from '../components/organisms/ConfiguracionesPanel/ConfiguracionesPanel';
import { NcfPanel } from '../components/organisms/NcfPanel/NcfPanel';
import { FormasPagoPanel } from '../components/organisms/FormasPagoPanel/FormasPagoPanel';
import { CategoriasPanel } from '../components/organisms/CategoriasPanel/CategoriasPanel';
import { ListasPrecioPanel } from '../components/organisms/ListasPrecioPanel/ListasPrecioPanel';
import { AtributosPanel } from '../components/organisms/AtributosPanel/AtributosPanel';
import { OfertasPanel } from '../components/organisms/OfertasPanel/OfertasPanel';
import { BonosPanel } from '../components/organisms/BonosPanel/BonosPanel';
import { CategoriasClientePanel } from '../components/organisms/CategoriasClientePanel/CategoriasClientePanel';
import { LeyesFiscalesPanel } from '../components/organisms/LeyesFiscalesPanel/LeyesFiscalesPanel';
import { useAuth } from '../hooks/useAuth';

interface Pestana {
  id: string;
  etiqueta: string;
  permiso: string;
  panel: () => JSX.Element;
}

interface Categoria {
  id: string;
  etiqueta: string;
  descripcion: string;
  pestanas: Pestana[];
}

const CATEGORIAS: Categoria[] = [
  {
    id: 'empresa',
    etiqueta: 'Empresa',
    descripcion: 'Usuarios y roles de acceso.',
    pestanas: [
      { id: 'usuarios', etiqueta: 'Usuarios', permiso: 'admin.usuarios', panel: UsuariosPanel },
      { id: 'roles', etiqueta: 'Roles y permisos', permiso: 'admin.usuarios', panel: RolesPanel },
    ],
  },
  {
    id: 'facturacion',
    etiqueta: 'Facturación',
    descripcion: 'Numeraciones de NCF (comprobantes fiscales), formas de pago y bonos.',
    pestanas: [
      { id: 'ncf', etiqueta: 'NCF', permiso: 'admin.configuracion', panel: NcfPanel },
      { id: 'formas-pago', etiqueta: 'Formas de pago', permiso: 'admin.configuracion', panel: FormasPagoPanel },
      { id: 'bonos', etiqueta: 'Bonos', permiso: 'admin.configuracion', panel: BonosPanel },
    ],
  },
  {
    id: 'catalogo',
    etiqueta: 'Catálogo',
    descripcion: 'Categorías de productos, niveles de precio, atributos de variantes y ofertas.',
    pestanas: [
      { id: 'categorias', etiqueta: 'Categorías', permiso: 'admin.configuracion', panel: CategoriasPanel },
      { id: 'categorias-cliente', etiqueta: 'Categorías de cliente', permiso: 'admin.configuracion', panel: CategoriasClientePanel },
      { id: 'listas-precio', etiqueta: 'Niveles de precio', permiso: 'admin.configuracion', panel: ListasPrecioPanel },
      { id: 'atributos', etiqueta: 'Atributos', permiso: 'admin.configuracion', panel: AtributosPanel },
      { id: 'ofertas', etiqueta: 'Ofertas', permiso: 'admin.configuracion', panel: OfertasPanel },
      { id: 'leyes-fiscales', etiqueta: 'Leyes fiscales', permiso: 'admin.configuracion', panel: LeyesFiscalesPanel },
    ],
  },
  {
    id: 'general',
    etiqueta: 'Configuración general',
    descripcion: 'Parámetros del tenant (ITBIS, plazos, stock mínimo).',
    pestanas: [{ id: 'configuracion', etiqueta: 'Parámetros', permiso: 'admin.configuracion', panel: ConfiguracionesPanel }],
  },
  {
    id: 'integraciones',
    etiqueta: 'Integraciones',
    descripcion: 'Webhooks hacia sistemas externos.',
    pestanas: [{ id: 'webhooks', etiqueta: 'Webhooks', permiso: 'admin.configuracion', panel: WebhooksPanel }],
  },
];

export function Admin() {
  const { tienePermiso } = useAuth();
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [pestanaId, setPestanaId] = useState<string | null>(null);

  const categoriasVisibles = CATEGORIAS.map((c) => ({
    ...c,
    pestanas: c.pestanas.filter((p) => tienePermiso(p.permiso)),
  })).filter((c) => c.pestanas.length > 0);

  const categoriaActiva = categoriasVisibles.find((c) => c.id === categoriaId) ?? null;
  const pestanaActiva = categoriaActiva
    ? categoriaActiva.pestanas.find((p) => p.id === pestanaId) ?? categoriaActiva.pestanas[0]
    : null;

  if (!categoriaActiva) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Configuración</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Usuarios, roles, NCF, parámetros e integraciones del tenant.</p>
        </div>

        {categoriasVisibles.length === 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
            No tenés permiso para ver ninguna sección de configuración.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoriasVisibles.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCategoriaId(c.id);
                setPestanaId(null);
              }}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-sol-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="font-medium text-slate-900 dark:text-slate-100">{c.etiqueta}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{c.descripcion}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const Panel = pestanaActiva?.panel;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCategoriaId(null)}
          className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
        >
          ← Configuración
        </button>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{categoriaActiva.etiqueta}</h1>
      </div>

      {categoriaActiva.pestanas.length > 1 && (
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {categoriaActiva.pestanas.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestanaId(p.id)}
              className={clsx(
                'border-b-2 px-3 py-2 text-sm font-medium',
                pestanaActiva?.id === p.id
                  ? 'border-sol-500 text-sol-600 dark:text-sol-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400',
              )}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      )}

      {Panel && <Panel />}
    </div>
  );
}
