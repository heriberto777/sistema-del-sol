import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { PaginaResultado } from '../../types/pagina-resultado';
import { ETIQUETA_OPERACION_PROPIEDAD, ETIQUETA_TIPO_PROPIEDAD, PropiedadPublica } from '../../types/inmobiliaria';

const FILAS: { etiqueta: string; valor: (p: PropiedadPublica) => string }[] = [
  { etiqueta: 'Precio', valor: (p) => `${p.moneda === 'DOP' ? 'RD$' : 'US$'} ${Number(p.precio).toLocaleString('es-DO')}${p.operacion === 'ALQUILER' ? '/mes' : ''}` },
  { etiqueta: 'Operación', valor: (p) => ETIQUETA_OPERACION_PROPIEDAD[p.operacion] ?? p.operacion },
  { etiqueta: 'Tipo', valor: (p) => ETIQUETA_TIPO_PROPIEDAD[p.tipo] ?? p.tipo },
  { etiqueta: 'Ubicación', valor: (p) => p.ubicacion },
  { etiqueta: 'Habitaciones', valor: (p) => p.habitaciones?.toString() ?? '—' },
  { etiqueta: 'Baños', valor: (p) => p.banos?.toString() ?? '—' },
  { etiqueta: 'Parqueos', valor: (p) => p.parqueos?.toString() ?? '—' },
  { etiqueta: 'm² construcción', valor: (p) => p.metrosConstruccion?.toString() ?? '—' },
  { etiqueta: 'Amenidades', valor: (p) => (p.amenidades.length ? p.amenidades.join(', ') : '—') },
];

export function ComparadorPropiedadesModal({ subdominio, ids, onClose }: { subdominio: string; ids: string[]; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['inmobiliaria-publica-comparador', subdominio, ids],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<PropiedadPublica>>(`/inmobiliaria/${subdominio}/propiedades`, { params: { ids: ids.join(','), tamanoPagina: 10 } }))
        .data,
  });

  const propiedades = data?.datos ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Comparar propiedades</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {isLoading && <p className="text-sm text-slate-400">Cargando…</p>}

        {!isLoading && propiedades.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="w-40 py-2 pr-3 text-xs font-semibold uppercase text-slate-400"></th>
                  {propiedades.map((p) => (
                    <th key={p.id} className="min-w-[180px] px-3 py-2 align-top">
                      <div className="h-24 overflow-hidden rounded-lg bg-teal-700/90">
                        {p.imagenes[0] && <img src={p.imagenes[0].imagen} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <p className="mt-2 font-semibold text-slate-900">{p.titulo}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FILAS.map((fila) => (
                  <tr key={fila.etiqueta} className="border-t border-slate-100">
                    <td className="py-2.5 pr-3 text-xs font-semibold uppercase text-slate-400">{fila.etiqueta}</td>
                    {propiedades.map((p) => (
                      <td key={p.id} className="px-3 py-2.5 text-slate-700">
                        {fila.valor(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
