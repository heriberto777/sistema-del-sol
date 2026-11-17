import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { platformApiClient } from '../lib/platform-api-client';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { usePlatformAuth } from '../hooks/usePlatformAuth';

type TipoCupon = 'PORCENTAJE' | 'MONTO_FIJO';

interface Cupon {
  id: string;
  codigo: string;
  tipo: TipoCupon;
  valor: string;
  duracionCiclos: number | null;
  fechaExpiracion: string | null;
  usosMaximos: number | null;
  usosActuales: number;
  activo: boolean;
}

export function PlatformCupones() {
  const navigate = useNavigate();
  const { tienePermiso } = usePlatformAuth();
  const puedeGestionar = tienePermiso('platform.facturacion.gestionar');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const queryClient = useQueryClient();

  const { data: cupones } = useQuery({
    queryKey: ['platform-cupones'],
    queryFn: async () => (await platformApiClient.get<Cupon[]>('/platform/cupones')).data,
  });

  const cambiarActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) =>
      platformApiClient.patch(`/platform/cupones/${id}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-cupones'] }),
  });

  const cuponesVisibles = (cupones ?? []).filter((c) => mostrarInactivos || c.activo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Cupones de descuento</h1>
        {puedeGestionar && <Button onClick={() => navigate('/plataforma/cupones/nuevo')}>Nuevo cupón</Button>}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {cupones ? `${cupones.length} cupón(es) en el catálogo` : 'Cargando…'}
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
          Mostrar inactivos
        </label>
      </div>

      {cuponesVisibles.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-400">
            {cupones?.length === 0 ? 'Todavía no hay cupones creados.' : 'No hay cupones activos — probá "Mostrar inactivos".'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cuponesVisibles.map((cupon) => (
            <TarjetaCupon
              key={cupon.id}
              cupon={cupon}
              puedeGestionar={puedeGestionar}
              onEditar={() => navigate(`/plataforma/cupones/${cupon.id}`)}
              onCambiarActivo={(activo) => cambiarActivo.mutate({ id: cupon.id, activo })}
              onVerAplicaciones={() => navigate(`/plataforma/cupones/${cupon.id}/aplicaciones`)}
            />
          ))}
        </div>
      )}

    </div>
  );
}

function TarjetaCupon({
  cupon,
  puedeGestionar,
  onEditar,
  onCambiarActivo,
  onVerAplicaciones,
}: {
  cupon: Cupon;
  puedeGestionar: boolean;
  onEditar: () => void;
  onCambiarActivo: (activo: boolean) => void;
  onVerAplicaciones: () => void;
}) {
  const expirado = Boolean(cupon.fechaExpiracion && new Date(cupon.fechaExpiracion) < new Date());
  const porcentajeUso = cupon.usosMaximos ? Math.min(100, (cupon.usosActuales / cupon.usosMaximos) * 100) : null;

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-base font-semibold text-slate-900 dark:text-slate-100">{cupon.codigo}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {cupon.duracionCiclos === null ? 'Duración indefinida' : `${cupon.duracionCiclos} ciclo(s)`}
          </p>
        </div>
        <p className="shrink-0 font-mono text-xl font-bold text-sol-600 dark:text-sol-400">
          {cupon.tipo === 'PORCENTAJE' ? `${cupon.valor}%` : `RD$ ${Number(cupon.valor).toLocaleString('es-DO')}`}
        </p>
      </div>

      <div className="my-3 border-t border-dashed border-slate-200 dark:border-slate-700" />

      <div className="flex-1 space-y-2 text-sm">
        <div className="flex justify-between text-slate-500 dark:text-slate-400">
          <span>Vigente hasta</span>
          <span className={`font-mono ${expirado ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
            {cupon.fechaExpiracion ? new Date(cupon.fechaExpiracion).toLocaleDateString('es-DO') : 'Sin expiración'}
          </span>
        </div>
        <div className="flex justify-between text-slate-500 dark:text-slate-400">
          <span>Usos</span>
          <span className="font-mono text-slate-900 dark:text-slate-100">
            {cupon.usosActuales} / {cupon.usosMaximos ?? '∞'}
          </span>
        </div>
        {porcentajeUso !== null && (
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${porcentajeUso >= 90 ? 'bg-red-500' : 'bg-sol-500'}`}
              style={{ width: `${porcentajeUso}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <Badge tono={!cupon.activo ? 'peligro' : expirado ? 'advertencia' : 'exito'}>
          {!cupon.activo ? 'Desactivado' : expirado ? 'Expirado' : 'Activo'}
        </Badge>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onVerAplicaciones} className="text-xs font-medium text-sol-600 hover:underline dark:text-sol-400">
            Ver aplicaciones
          </button>
          {puedeGestionar && (
            <RowActionsMenu
              acciones={[
                { etiqueta: 'Editar', onClick: onEditar },
                cupon.activo
                  ? { etiqueta: 'Desactivar', tono: 'peligro' as const, onClick: () => onCambiarActivo(false) }
                  : { etiqueta: 'Activar', onClick: () => onCambiarActivo(true) },
              ]}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
