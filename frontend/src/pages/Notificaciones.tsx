import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface Notificacion {
  id: string;
  canal: string;
  destinatario: string;
  asunto: string | null;
  estado: 'PENDIENTE' | 'ENVIADA' | 'FALLIDA';
  createdAt: string;
}

const TONO_POR_ESTADO: Record<Notificacion['estado'], 'exito' | 'advertencia' | 'peligro'> = {
  ENVIADA: 'exito',
  PENDIENTE: 'advertencia',
  FALLIDA: 'peligro',
};

export function Notificaciones() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Notificaciones</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Historial de envíos por canal.</p>
      </div>

      <HistorialNotificaciones />
    </div>
  );
}

function HistorialNotificaciones() {
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data } = useQuery({
    queryKey: ['notificaciones', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Notificacion>>('/notificaciones', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <RequierePermiso permiso="notificaciones.ver">
      <div className="space-y-4">
        <SearchInput
          value={busqueda}
          onChange={(v) => {
            setBusqueda(v);
            setPagina(1);
          }}
          placeholder="Buscar por destinatario o asunto…"
        />
        <Card sinPadding>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data?.datos.map((n) => (
              <div key={n.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{n.asunto ?? n.canal}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{n.destinatario}</p>
                </div>
                <Badge tono={TONO_POR_ESTADO[n.estado]}>{n.estado}</Badge>
              </div>
            ))}
            {data?.datos.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-slate-400">Todavía no hay notificaciones.</p>
            )}
          </div>
        </Card>
        {data && (
          <Paginacion
            pagina={data.pagina}
            tamanoPagina={data.tamanoPagina}
            total={data.total}
            onCambiarPagina={setPagina}
          />
        )}
      </div>
    </RequierePermiso>
  );
}
