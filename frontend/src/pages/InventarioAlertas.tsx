import { useState } from 'react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, type LucideIcon, PackageX, XOctagon } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { StatCard } from '../components/molecules/StatCard/StatCard';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useSucursalActiva } from '../hooks/useSucursalActiva';
import { PaginaResultado } from '../types/pagina-resultado';

interface Resumen {
  alertasInventario: { sinStock: number; stockBajo: number; porVencer7Dias: number; vencidos: number };
}

interface FilaStock {
  varianteId: string;
  cantidadActual: string;
  stockMinimo: string;
  producto: { codigo: string; nombre: string };
  bodega: { nombre: string };
  valoresAtributo: { atributo: string; valor: string }[];
}

interface FilaLote {
  id: string;
  numeroLote: string;
  fechaVencimiento: string;
  cantidadActual: string;
  producto: { codigo: string; nombre: string };
  bodega: { nombre: string };
  valoresAtributo: { atributo: string; valor: string }[];
}

// Ítem E-12 — Cuadre tiene 4 tabs (Resumen/Stock Bajo/Sin Stock/Por Vencer);
// acá se agrega una 5ta ("Vencidos") porque el sistema ya distingue esa
// categoría de "por vencer" en vez de mezclarlas (ver E-4).
const PESTANAS = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'sinStock', etiqueta: 'Sin stock' },
  { id: 'stockBajo', etiqueta: 'Stock bajo' },
  { id: 'porVencer', etiqueta: 'Por vencer' },
  { id: 'vencidos', etiqueta: 'Vencidos' },
] as const;

type PestanaId = (typeof PESTANAS)[number]['id'];

function nombreVariante(producto: { nombre: string }, valoresAtributo: { atributo: string; valor: string }[]) {
  if (valoresAtributo.length === 0) return producto.nombre;
  return `${producto.nombre} (${valoresAtributo.map((va) => `${va.atributo}: ${va.valor}`).join(', ')})`;
}

export function InventarioAlertas() {
  const [pestana, setPestana] = useState<PestanaId>('resumen');

  return (
    <RequierePermiso permiso="inventario.ver">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Alertas de inventario</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Sin stock, stock bajo, por vencer y vencidos — con detalle por producto.</p>
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

        {pestana === 'resumen' ? <ResumenAlertas onVerCategoria={setPestana} /> : <ListadoCategoria categoria={pestana} />}
      </div>
    </RequierePermiso>
  );
}

function ResumenAlertas({ onVerCategoria }: { onVerCategoria: (categoria: PestanaId) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reportes-dashboard-alertas'],
    queryFn: async () => (await apiClient.get<Resumen>('/reportes/dashboard')).data,
  });

  const tarjetas: { etiqueta: string; valor: number | undefined; icono: LucideIcon; categoria: PestanaId }[] = [
    { etiqueta: 'Sin stock', valor: data?.alertasInventario.sinStock, icono: PackageX, categoria: 'sinStock' },
    { etiqueta: 'Stock bajo', valor: data?.alertasInventario.stockBajo, icono: AlertTriangle, categoria: 'stockBajo' },
    { etiqueta: 'Por vencer (7 días)', valor: data?.alertasInventario.porVencer7Dias, icono: CalendarClock, categoria: 'porVencer' },
    { etiqueta: 'Vencidos', valor: data?.alertasInventario.vencidos, icono: XOctagon, categoria: 'vencidos' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tarjetas.map((t) => (
        <button key={t.categoria} onClick={() => onVerCategoria(t.categoria)} className="text-left">
          <StatCard etiqueta={t.etiqueta} valor={isLoading ? '…' : String(t.valor ?? 0)} icono={t.icono} />
        </button>
      ))}
    </div>
  );
}

const CONFIG_CATEGORIA: Record<Exclude<PestanaId, 'resumen'>, { columnaFecha: boolean }> = {
  sinStock: { columnaFecha: false },
  stockBajo: { columnaFecha: false },
  porVencer: { columnaFecha: true },
  vencidos: { columnaFecha: true },
};

function ListadoCategoria({ categoria }: { categoria: Exclude<PestanaId, 'resumen'> }) {
  const { sucursales } = useSucursalActiva();
  // Arranca en "todas las sucursales" (no en la sucursal activa del
  // usuario) a propósito: el tab "Resumen" y el popup proactivo cuentan
  // sobre TODAS las sucursales, sin filtro — si esta tabla arrancara
  // filtrada por la sucursal activa, un usuario que entra desde "Ver
  // Alertas →" podía ver "Sin resultados" para una categoría que el
  // resumen le acababa de decir que tenía elementos (bug real encontrado
  // al probar en vivo: los 2 "Vencidos" del resumen estaban en una
  // sucursal distinta a la activa del usuario de prueba).
  const [sucursalFiltro, setSucursalFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const { columnaFecha } = CONFIG_CATEGORIA[categoria];

  const { data, isLoading } = useQuery({
    queryKey: ['inventario-alertas', categoria, sucursalFiltro, pagina],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<FilaStock | FilaLote>>('/inventario/alertas', {
          params: { categoria, sucursalId: sucursalFiltro || undefined, pagina },
        })
      ).data,
  });

  const filas = data?.datos ?? [];

  return (
    <div className="space-y-3">
      {sucursales.length > 1 && (
        <Select value={sucursalFiltro} onChange={(e) => { setSucursalFiltro(e.target.value); setPagina(1); }} className="!w-auto">
          <option value="">Todas las sucursales</option>
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </Select>
      )}

      <Card sinPadding>
        {!isLoading && filas.length === 0 ? (
          <div className="p-5">
            <EstadoVacio titulo="Sin resultados" descripcion="No hay productos en esta categoría por ahora." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Producto</th>
                  <th className="px-5 py-3 font-medium">Bodega</th>
                  {columnaFecha ? (
                    <>
                      <th className="px-5 py-3 font-medium">Lote</th>
                      <th className="px-5 py-3 font-medium">Vencimiento</th>
                    </>
                  ) : (
                    <th className="px-5 py-3 font-medium">Mínimo</th>
                  )}
                  <th className="px-5 py-3 font-medium">Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filas.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{nombreVariante(f.producto, f.valoresAtributo)}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.bodega.nombre}</td>
                    {columnaFecha ? (
                      <>
                        <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{(f as FilaLote).numeroLote}</td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                          {new Date((f as FilaLote).fechaVencimiento).toLocaleDateString('es-DO')}
                        </td>
                      </>
                    ) : (
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{(f as FilaStock).stockMinimo}</td>
                    )}
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.cantidadActual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 0 && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>
    </div>
  );
}
