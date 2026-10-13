import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { EstadoVacio } from '../../molecules/EstadoVacio/EstadoVacio';
import { useAuth } from '../../../hooks/useAuth';
import { MetaVenta } from '../../../types/crm';
import { ModalFormMetaVenta } from './ModalFormMetaVenta';

const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function formatearMoneda(monto: number) {
  return `RD$ ${monto.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function CrmMetasVentaPanel() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [creando, setCreando] = useState(false);

  const { data: metas, isLoading } = useQuery({
    queryKey: ['crm-metas-venta', anio, mes],
    queryFn: async () => (await apiClient.get<MetaVenta[]>('/crm/metas-venta', { params: { anio, mes } })).data,
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/crm/metas-venta/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-metas-venta'] }),
  });

  function cambiarMes(delta: number) {
    const fecha = new Date(anio, mes - 1 + delta, 1);
    setAnio(fecha.getFullYear());
    setMes(fecha.getMonth() + 1);
  }

  return (
    <div className="space-y-4">
      <Card
        titulo={`${NOMBRES_MES[mes - 1]} ${anio}`}
        acciones={
          <div className="flex items-center gap-2">
            <Button variante="secundario" onClick={() => cambiarMes(-1)}>
              ← Anterior
            </Button>
            <Button variante="secundario" onClick={() => cambiarMes(1)}>
              Siguiente →
            </Button>
            {tienePermiso('crm.metas.configurar') && <Button onClick={() => setCreando(true)}>Nueva meta</Button>}
          </div>
        }
      >
        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
        {!isLoading && metas?.length === 0 && (
          <EstadoVacio titulo="Sin metas este mes" descripcion="Todavía no hay metas de venta configuradas para este período." />
        )}
        <div className="flex flex-col gap-3">
          {metas?.map((meta) => {
            const porcentaje = Math.min(100, Math.round(meta.porcentajeCumplido * 100));
            const superado = meta.porcentajeCumplido >= 1;
            return (
              <div key={meta.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{meta.nombre}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {formatearMoneda(meta.montoReal)} / {formatearMoneda(meta.montoMeta)}
                    </span>
                    {tienePermiso('crm.metas.configurar') && (
                      <button type="button" onClick={() => eliminar.mutate(meta.id)} className="text-xs text-red-500 hover:text-red-700">
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={superado ? 'h-full rounded-full bg-emerald-500' : 'h-full rounded-full bg-sol-500'}
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-slate-400">{Math.round(meta.porcentajeCumplido * 100)}% cumplido</p>
              </div>
            );
          })}
        </div>
      </Card>

      {creando && <ModalFormMetaVenta anio={anio} mes={mes} onClose={() => setCreando(false)} />}
    </div>
  );
}
