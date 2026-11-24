import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformApiClient } from '../lib/platform-api-client';
import { textoPlanoDesdeTiptap } from '../lib/tiptap-texto-plano';
import { Badge } from '../components/atoms/Badge/Badge';
import { Select } from '../components/atoms/Select/Select';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';
import { ETIQUETA_CATEGORIA_SOPORTE, ETIQUETA_ESTADO_SOPORTE, TONO_ESTADO_SOPORTE, type Categoria, type Estado, type MensajeSoporte } from '../types/soporte';
import { ConversacionSoportePlataforma } from '../components/organisms/ConversacionSoportePlataforma/ConversacionSoportePlataforma';

interface TicketListaPlataforma {
  id: string;
  asunto: string;
  categoria: Categoria;
  estado: Estado;
  ultimoMensajeEn: string;
  tenant: { id: string; nombre: string; subdominio: string };
  usuario: { id: string; nombre: string; email: string | null };
  mensajes: MensajeSoporte[];
}

/** Lado plataforma de Soporte (rediseño v2) — bandeja estilo inbox, "Bandeja de Entrada Avanzada" de tus capturas: lista con filtros + conversación lado a lado, mismo patrón que Mensajes.tsx (inbox de WhatsApp). */
export function PlatformSoporte() {
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [ticketSeleccionado, setTicketSeleccionado] = useState<string | null>(null);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-reportes-tenant', busquedaDebounced, estadoFiltro, categoriaFiltro, desde, hasta],
    queryFn: async () =>
      (
        await platformApiClient.get<PaginaResultado<TicketListaPlataforma>>('/platform/reportes-tenant', {
          params: {
            tamanoPagina: 50,
            busqueda: busquedaDebounced || undefined,
            estado: estadoFiltro || undefined,
            categoria: categoriaFiltro || undefined,
            desde: desde || undefined,
            hasta: hasta || undefined,
          },
        })
      ).data,
    refetchInterval: 20_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Soporte</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Reportes de todos los tenants — filtrá por estado, categoría o fecha.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por tenant o asunto…" />
        <Select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="!w-auto">
          <option value="">Todos los estados</option>
          {Object.entries(ETIQUETA_ESTADO_SOPORTE).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </Select>
        <Select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="!w-auto">
          <option value="">Todas las categorías</option>
          {Object.entries(ETIQUETA_CATEGORIA_SOPORTE).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </Select>
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          aria-label="Desde"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          aria-label="Hasta"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="flex h-[calc(100vh-260px)] min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex w-80 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800">
          <div className="flex-1 overflow-y-auto">
            {isLoading && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
            {!isLoading && data?.datos.length === 0 && (
              <div className="p-4">
                <EstadoVacio titulo="Sin reportes" descripcion="Todavía ningún tenant reportó nada con este filtro." />
              </div>
            )}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.datos.map((t) => {
                const seleccionado = ticketSeleccionado === t.id;
                const ultimoMensaje = t.mensajes[0];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTicketSeleccionado(t.id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      seleccionado ? 'bg-slate-50 dark:bg-slate-800/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100">{t.tenant.nombre}</span>
                      <span className="shrink-0 text-xs text-slate-400">{new Date(t.ultimoMensajeEn).toLocaleDateString('es-DO')}</span>
                    </div>
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">{t.asunto}</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-slate-400">{ultimoMensaje ? textoPlanoDesdeTiptap(ultimoMensaje.cuerpo) : ''}</span>
                      <Badge tono={TONO_ESTADO_SOPORTE[t.estado]}>{ETIQUETA_ESTADO_SOPORTE[t.estado]}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1">
          {ticketSeleccionado ? (
            <ConversacionSoportePlataforma key={ticketSeleccionado} ticketId={ticketSeleccionado} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EstadoVacio titulo="Elegí un ticket" descripcion="Seleccioná uno de la lista para ver la conversación completa." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
