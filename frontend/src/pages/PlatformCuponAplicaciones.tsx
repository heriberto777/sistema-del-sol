import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { platformApiClient } from '../lib/platform-api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';

interface Cupon {
  id: string;
  codigo: string;
}

interface AplicacionCupon {
  id: string;
  ciclosRestantes: number | null;
  activo: boolean;
  fechaAplicado: string;
  tenant: { id: string; nombre: string };
}

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalAplicacionesCupon de PlatformCupones.tsx. */
export function PlatformCuponAplicaciones() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: cupones } = useQuery({
    queryKey: ['platform-cupones'],
    queryFn: async () => (await platformApiClient.get<Cupon[]>('/platform/cupones')).data,
  });
  const cupon = cupones?.find((c) => c.id === id);

  const { data: aplicaciones } = useQuery({
    queryKey: ['platform-cupon-aplicaciones', id],
    queryFn: async () => (await platformApiClient.get<AplicacionCupon[]>(`/platform/cupones/${id}/aplicaciones`)).data,
  });

  return (
    <PaginaDocumento
      titulo={cupon ? `Aplicaciones de "${cupon.codigo}"` : 'Aplicaciones del cupón'}
      rutaVolver="/plataforma/cupones"
      etiquetaVolver="Volver a Cupones"
      haycambios={false}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{aplicaciones?.length ?? '—'} canje(s)</span>
        </div>
      }
      acciones={
        <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/plataforma/cupones')}>
          Volver
        </Button>
      }
    >
      <Card titulo="Historial de canjes" descripcion="Incluye los que ya no están vigentes.">
        <div className="space-y-2 sm:col-span-2">
          {aplicaciones?.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.tenant.nombre}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aplicado el {new Date(a.fechaAplicado).toLocaleDateString('es-DO')} —{' '}
                  {a.ciclosRestantes === null ? 'indefinido' : `${a.ciclosRestantes} ciclo(s) restante(s)`}
                </p>
              </div>
              <Badge tono={a.activo ? 'exito' : 'neutro'}>{a.activo ? 'Vigente' : 'No vigente'}</Badge>
            </div>
          ))}
          {aplicaciones?.length === 0 && <p className="text-sm text-slate-400">Todavía no lo canjeó ningún tenant.</p>}
        </div>
      </Card>
    </PaginaDocumento>
  );
}
