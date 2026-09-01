import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformApiClient } from '../lib/platform-api-client';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { PaginaResultado } from '../types/pagina-resultado';

interface RegistroAuditoria {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  createdAt: string;
  admin: { nombre: string; email: string } | null;
}

function tonoPorAccion(accion: string): 'exito' | 'advertencia' | 'peligro' | 'neutro' {
  const clave = accion.toLowerCase();
  if (clave.includes('suspend') || clave.includes('cancel') || clave.includes('desactiv')) return 'peligro';
  if (clave.includes('crea') || clave.includes('activ')) return 'exito';
  if (clave.includes('actualiz') || clave.includes('edit') || clave.includes('cambi')) return 'advertencia';
  return 'neutro';
}

export function PlatformActividad() {
  const [pagina, setPagina] = useState(1);

  const { data: auditoria } = useQuery({
    queryKey: ['platform-audit-log', pagina],
    queryFn: async () =>
      (
        await platformApiClient.get<PaginaResultado<RegistroAuditoria>>('/platform/audit-log', {
          params: { pagina },
        })
      ).data,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Actividad</h1>

      <Card sinPadding titulo="Actividad reciente" descripcion="Bitácora de acciones realizadas desde la plataforma.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Admin</th>
                <th className="px-5 py-3 font-medium">Acción</th>
                <th className="px-5 py-3 font-medium">Entidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditoria?.datos.map((registro) => (
                <tr key={registro.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {new Date(registro.createdAt).toLocaleString('es-DO')}
                  </td>
                  <td className="px-5 py-3">{registro.admin?.nombre ?? '—'}</td>
                  <td className="px-5 py-3">
                    <Badge tono={tonoPorAccion(registro.accion)}>{registro.accion}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{registro.entidad}</td>
                </tr>
              ))}
              {auditoria?.datos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                    Todavía no hay actividad registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {auditoria && (
          <div className="px-5 py-3">
            <Paginacion pagina={auditoria.pagina} tamanoPagina={auditoria.tamanoPagina} total={auditoria.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>
    </div>
  );
}
