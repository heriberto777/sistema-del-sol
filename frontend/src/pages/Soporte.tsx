import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { PaginaResultado } from '../types/pagina-resultado';

type Categoria = 'BUG' | 'DUDA' | 'SOLICITUD' | 'OTRO';
type Estado = 'NUEVO' | 'EN_REVISION' | 'RESUELTO';

interface ReporteTenant {
  id: string;
  asunto: string;
  descripcion: string;
  categoria: Categoria;
  estado: Estado;
  respuesta: string | null;
  respondidoEn: string | null;
  createdAt: string;
}

const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  BUG: 'Algo no funciona',
  DUDA: 'Duda',
  SOLICITUD: 'Solicitud / idea',
  OTRO: 'Otro',
};

const ETIQUETA_ESTADO: Record<Estado, string> = { NUEVO: 'Enviado', EN_REVISION: 'En revisión', RESUELTO: 'Resuelto' };
const TONO_ESTADO: Record<Estado, 'neutro' | 'advertencia' | 'exito'> = { NUEVO: 'neutro', EN_REVISION: 'advertencia', RESUELTO: 'exito' };

/**
 * "Reportar un problema" (Bloque 4 del backlog UX/operación) — canal
 * directo tenant → plataforma, deliberadamente liviano (sin SLA, sin
 * notificación por email todavía). Vive en GRUPO_MI_ESPACIO (menu-erp.ts)
 * sin permiso restrictivo — cualquier usuario autenticado puede reportar.
 */
export function Soporte() {
  const queryClient = useQueryClient();
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('DUDA');
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['reportes-tenant'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ReporteTenant>>('/reportes-tenant', { params: { tamanoPagina: 50 } })).data,
  });

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/reportes-tenant', { asunto, descripcion, categoria }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportes-tenant'] });
      setAsunto('');
      setDescripcion('');
      setCategoria('DUDA');
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar el reporte. Revisá los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Soporte</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Reportá un problema, una duda o una idea — lo recibe directamente el equipo de la plataforma.
        </p>
      </div>

      <Card titulo="Nuevo reporte">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem]">
            <FormField id="soporte-asunto" label="Asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} required />
            <div className="flex flex-col gap-1">
              <label htmlFor="soporte-categoria" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Categoría
              </label>
              <Select id="soporte-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)}>
                {Object.entries(ETIQUETA_CATEGORIA).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="soporte-descripcion" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Descripción
            </label>
            <textarea
              id="soporte-descripcion"
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Contanos qué pasó o qué necesitás — cuanto más detalle, más rápido lo podemos resolver."
              required
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" disabled={crear.isPending}>
            {crear.isPending ? 'Enviando…' : 'Enviar reporte'}
          </Button>
        </form>
      </Card>

      <Card sinPadding titulo="Tus reportes" descripcion={data ? `${data.total} reporte(s)` : undefined}>
        {data?.datos.length === 0 ? (
          <div className="p-5">
            <EstadoVacio titulo="Sin reportes todavía" descripcion="Cuando envíes uno, lo vas a ver listado acá con su estado y la respuesta del equipo." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data?.datos.map((r) => (
              <div key={r.id} className="space-y-2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{r.asunto}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {ETIQUETA_CATEGORIA[r.categoria]} — {new Date(r.createdAt).toLocaleDateString('es-DO')}
                    </p>
                  </div>
                  <Badge tono={TONO_ESTADO[r.estado]}>{ETIQUETA_ESTADO[r.estado]}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{r.descripcion}</p>
                {r.respuesta && (
                  <div className="rounded-lg border border-sol-200 bg-sol-50 p-3 text-sm dark:border-sol-900 dark:bg-sol-900/20">
                    <p className="font-medium text-sol-800 dark:text-sol-300">Respuesta del equipo</p>
                    <p className="text-slate-700 dark:text-slate-300">{r.respuesta}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
