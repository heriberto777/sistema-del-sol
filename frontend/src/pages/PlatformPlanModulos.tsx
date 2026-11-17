import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import { platformApiClient } from '../lib/platform-api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';

interface Modulo {
  id: string;
  clave: string;
  nombre: string;
}

interface Plan {
  id: string;
  nombre: string;
  modulos: { modulo: Modulo }[];
}

/**
 * Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalVerModulos de PlatformPlanes.tsx.
 * Solo lectura — a diferencia de PlatformPlanVer.tsx (que edita la selección), esta muestra el catálogo completo con check/tachado contra ESTE plan.
 */
export function PlatformPlanModulos() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: plan } = useQuery({
    queryKey: ['platform-planes', id],
    queryFn: async () => (await platformApiClient.get<Plan>(`/platform/planes/${id}`)).data,
  });
  const { data: catalogoModulos } = useQuery({
    queryKey: ['platform-planes-modulos'],
    queryFn: async () => (await platformApiClient.get<Modulo[]>('/platform/planes/modulos')).data,
  });
  const clavesIncluidas = new Set(plan?.modulos.map((pm) => pm.modulo.clave) ?? []);

  return (
    <PaginaDocumento
      titulo={plan ? `Módulos de "${plan.nombre}"` : 'Módulos del plan'}
      rutaVolver="/plataforma/planes"
      etiquetaVolver="Volver a Planes"
      haycambios={false}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Incluidos</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {plan?.modulos.length ?? '—'} de {catalogoModulos?.length ?? '…'}
          </span>
        </div>
      }
      acciones={
        <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/plataforma/planes')}>
          Volver
        </Button>
      }
    >
      <Card titulo="Catálogo de módulos">
        <div className="sm:col-span-2">
          {!catalogoModulos && <p className="text-sm text-slate-400">Cargando catálogo de módulos…</p>}

          {catalogoModulos && (
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {catalogoModulos.map((modulo) => {
                const activo = clavesIncluidas.has(modulo.clave);
                return (
                  <div
                    key={modulo.clave}
                    className={clsx('flex items-center gap-2 text-sm', activo ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-600')}
                  >
                    {activo ? <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <X className="h-4 w-4 shrink-0" />}
                    <span className={activo ? '' : 'line-through'}>{modulo.nombre}</span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
            Contabilidad, Contactos, Reportes, Notificaciones y Admin quedan siempre activos, en todos los planes, sin excepción posible.
          </p>
        </div>
      </Card>
    </PaginaDocumento>
  );
}
