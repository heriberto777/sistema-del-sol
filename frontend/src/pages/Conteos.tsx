import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { PaginaResultado } from '../types/pagina-resultado';
import type { BodegaBasica } from '@backend-src/common/prisma/bodega-select-basico';

type Bodega = BodegaBasica;

interface ConteoResumen {
  id: string;
  numero: string;
  alcance: 'TOTAL' | 'SELECCION';
  estado: 'ABIERTO' | 'APLICADO' | 'CANCELADO';
  fechaInicio: string;
  bodega: Bodega;
  totalLineas: number;
  lineasContadas: number;
}

const ETIQUETA_ESTADO: Record<ConteoResumen['estado'], string> = { ABIERTO: 'Abierto', APLICADO: 'Aplicado', CANCELADO: 'Cancelado' };
const TONO_ESTADO: Record<ConteoResumen['estado'], 'advertencia' | 'exito' | 'peligro'> = { ABIERTO: 'advertencia', APLICADO: 'exito', CANCELADO: 'peligro' };

/**
 * Auditoría UX (post Período Contable, 2026-11) — "Nuevo conteo" pasó de
 * modal (`ModalNuevoConteo`) a página real (`InventarioConteoNuevo`,
 * `/inventario/conteos/nuevo`), mismo criterio ya aplicado a
 * Ajustes/Transferencias.
 */
export function Conteos() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['conteos-fisicos'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ConteoResumen>>('/inventario/conteos', { params: { tamanoPagina: 50 } })).data,
  });

  const conteos = data?.datos ?? [];

  return (
    <RequierePermiso permiso="inventario.ver">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Conteos físicos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Contá a ciegas, revisá la diferencia contra el sistema, y aplicá solo lo que corresponda.</p>
          </div>
          {tienePermiso('inventario.contar') && <Button onClick={() => navigate('/inventario/conteos/nuevo')}>Nuevo conteo</Button>}
        </div>

        <Card sinPadding>
          {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && conteos.length === 0 && (
            <div className="p-5">
              <EstadoVacio titulo="Sin conteos todavía" descripcion="Iniciá un conteo físico para comparar el stock real contra lo que dice el sistema." />
            </div>
          )}
          {conteos.length > 0 && (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Número</th>
                  <th className="px-5 py-3 font-medium">Bodega</th>
                  <th className="px-5 py-3 font-medium">Alcance</th>
                  <th className="px-5 py-3 font-medium">Progreso</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {conteos.map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-xs">{c.numero}</td>
                      <td className="px-5 py-3">{c.bodega.nombre}</td>
                      <td className="px-5 py-3">{c.alcance === 'TOTAL' ? 'Todo el catálogo' : 'Selección'}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{c.lineasContadas}/{c.totalLineas} contados</td>
                      <td className="px-5 py-3">
                        <Badge tono={TONO_ESTADO[c.estado]}>{ETIQUETA_ESTADO[c.estado]}</Badge>
                      </td>
                      <td className="px-5 py-3">{new Date(c.fechaInicio).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3 text-right">
                        <Button variante="secundario" onClick={() => navigate(`/inventario/conteos/${c.id}`)}>
                          {c.estado === 'ABIERTO' ? 'Continuar' : 'Ver'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      </div>
    </RequierePermiso>
  );
}
