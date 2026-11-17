import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

type TipoAusencia = 'VACACIONES' | 'ENFERMEDAD' | 'PERMISO' | 'INJUSTIFICADA' | 'MATERNIDAD_PATERNIDAD' | 'OTRO';
type EstadoAusencia = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA';

interface Ausencia {
  id: string;
  tipo: TipoAusencia;
  fechaDesde: string;
  fechaHasta: string;
  conGoceDeSueldo: boolean;
  motivo: string | null;
  estado: EstadoAusencia;
  empleado: { id: string; nombre: string; cedula: string };
}

const ETIQUETAS_TIPO: Record<TipoAusencia, string> = {
  VACACIONES: 'Vacaciones',
  ENFERMEDAD: 'Enfermedad',
  PERMISO: 'Permiso',
  INJUSTIFICADA: 'Injustificada',
  MATERNIDAD_PATERNIDAD: 'Maternidad/Paternidad',
  OTRO: 'Otro',
};

const TONOS_ESTADO: Record<EstadoAusencia, 'neutro' | 'exito' | 'peligro'> = {
  SOLICITADA: 'neutro',
  APROBADA: 'exito',
  RECHAZADA: 'peligro',
};

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-DO', { timeZone: 'UTC' });
}

export function AusenciasTable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [pagina, setPagina] = useState(1);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['rrhh-ausencias', pagina],
    queryFn: async () => (await apiClient.get<PaginaResultado<Ausencia>>('/nomina/ausencias', { params: { pagina } })).data,
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'APROBADA' | 'RECHAZADA' }) =>
      apiClient.patch(`/nomina/ausencias/${id}/estado`, { estado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rrhh-ausencias'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {tienePermiso('rrhh.editar') && <Button onClick={() => navigate('/ausencias/nueva')}>Solicitar ausencia</Button>}
      </div>

      <Card sinPadding titulo="Ausencias" descripcion={data ? `${data.total} solicitud(es)` : undefined}>
        {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando ausencias…</p>}
        {errorCarga && <p className="p-5 text-sm text-red-600">No se pudieron cargar las ausencias.</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Empleado</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Desde</th>
                  <th className="px-5 py-3 font-medium">Hasta</th>
                  <th className="px-5 py-3 font-medium">Goce de sueldo</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.datos.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{a.empleado.nombre}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{ETIQUETAS_TIPO[a.tipo]}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{formatearFecha(a.fechaDesde)}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{formatearFecha(a.fechaHasta)}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{a.conGoceDeSueldo ? 'Sí' : 'No'}</td>
                    <td className="px-5 py-3">
                      <Badge tono={TONOS_ESTADO[a.estado]}>{a.estado}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      {a.estado === 'SOLICITADA' && tienePermiso('rrhh.aprobar') && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => cambiarEstado.mutate({ id: a.id, estado: 'APROBADA' })}
                            disabled={cambiarEstado.isPending}
                          >
                            Aprobar
                          </Button>
                          <Button
                            variante="peligro"
                            onClick={() => cambiarEstado.mutate({ id: a.id, estado: 'RECHAZADA' })}
                            disabled={cambiarEstado.isPending}
                          >
                            Rechazar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {data.datos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-slate-500 dark:text-slate-400">
                      Sin solicitudes de ausencia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div className="px-5 py-3">
            <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
          </div>
        )}
      </Card>
    </div>
  );
}
