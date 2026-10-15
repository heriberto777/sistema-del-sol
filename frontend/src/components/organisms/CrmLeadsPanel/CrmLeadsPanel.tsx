import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';
import { EstadoLead, ETIQUETA_ESTADO_LEAD, Lead, TONO_ESTADO_LEAD } from '../../../types/crm';
import { ModalFormLead } from './ModalFormLead';
import { ModalDetalleLead } from './ModalDetalleLead';

export function CrmLeadsPanel() {
  const { tienePermiso } = useAuth();
  const location = useLocation();
  // "El ancla" — la Bandeja de WhatsApp manda para acá con esto en
  // location.state cuando el vendedor hace clic en "Ver lead" de una
  // conversación, para no hacerlo buscar el teléfono a mano.
  const [busqueda, setBusqueda] = useState((location.state as { busquedaInicial?: string } | null)?.busquedaInicial ?? '');
  const [estado, setEstado] = useState<EstadoLead | ''>('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const [leadEditando, setLeadEditando] = useState<Lead | null | undefined>(undefined);
  const [leadViendo, setLeadViendo] = useState<Lead | null>(null);

  const { data } = useQuery({
    queryKey: ['crm-leads', pagina, busquedaDebounced, estado],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<Lead>>('/crm/leads', {
          params: { pagina, busqueda: busquedaDebounced || undefined, estado: estado || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <Card
        sinPadding
        titulo="Leads"
        descripcion={data ? `${data.total} lead(s)` : undefined}
        acciones={
          <div className="flex items-center gap-2">
            <SearchInput
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              placeholder="Buscar por nombre, email o teléfono…"
            />
            <select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value as EstadoLead | '');
                setPagina(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ETIQUETA_ESTADO_LEAD).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
            {tienePermiso('crm.leads.crear') && <Button onClick={() => setLeadEditando(null)}>Nuevo lead</Button>}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Contacto</th>
                <th className="px-5 py-3 font-medium">Origen</th>
                <th className="px-5 py-3 font-medium">Vendedor</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.datos.map((lead) => {
                const acciones = [
                  { etiqueta: 'Ver detalle', onClick: () => setLeadViendo(lead) },
                  ...(tienePermiso('crm.leads.editar') && lead.estado !== 'CONVERTIDO'
                    ? [{ etiqueta: 'Editar', onClick: () => setLeadEditando(lead) }]
                    : []),
                ];
                return (
                  <tr key={lead.id} onClick={() => setLeadViendo(lead)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{lead.nombre}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{lead.email ?? lead.telefono ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{lead.origen}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{lead.vendedor?.nombre ?? '—'}</td>
                    <td className="px-5 py-3">
                      <Badge tono={TONO_ESTADO_LEAD[lead.estado]}>{ETIQUETA_ESTADO_LEAD[lead.estado]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu acciones={acciones} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data?.datos.length === 0 && (
            <div className="p-6">
              <EstadoVacio titulo="Sin leads" descripcion="Todavía no hay prospectos cargados con estos filtros." />
            </div>
          )}
        </div>
        {data && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>

      {leadEditando !== undefined && <ModalFormLead lead={leadEditando} onClose={() => setLeadEditando(undefined)} />}
      {leadViendo && <ModalDetalleLead lead={leadViendo} onClose={() => setLeadViendo(null)} />}
    </div>
  );
}
