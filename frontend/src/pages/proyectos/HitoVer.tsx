import { FormEvent, useEffect, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Circle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Badge } from '../../components/atoms/Badge/Badge';
import { Button } from '../../components/atoms/Button/Button';
import { Select } from '../../components/atoms/Select/Select';
import { FormField } from '../../components/molecules/FormField/FormField';
import { ConfirmModal } from '../../components/molecules/ConfirmModal/ConfirmModal';
import { FacturarHitoModal } from '../../components/organisms/FacturarHitoModal/FacturarHitoModal';
import { RequierePermiso } from '../../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../../hooks/useAuth';
import { useHayCambios } from '../../hooks/useHayCambios';
import { ESTADOS_HITO, ETIQUETA_ESTADO_HITO, ETIQUETA_ESTADO_TAREA, ProyectoDetalleDto } from '../../types/proyectos';

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * HitoFormModal (modo "Editar") + HitoDetalleModal de ProyectoHitosTab.tsx.
 * "Facturar" queda en modal (confirmación con previsualización, mismo
 * criterio que "Registrar cobro") y "Eliminar" en ConfirmModal.
 */
export function HitoVer() {
  const { id: proyectoId, hitoId } = useParams<{ id: string; hitoId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();

  const { data: proyecto } = useQuery({
    queryKey: ['proyecto', proyectoId],
    queryFn: async () => (await apiClient.get<ProyectoDetalleDto>(`/admin/proyectos/${proyectoId}`)).data,
  });
  const hito = proyecto?.hitos.find((h) => h.id === hitoId);
  const tareasDelHito = proyecto?.tareas.filter((t) => t.hitoId === hitoId) ?? [];
  const terminadas = tareasDelHito.filter((t) => t.estado === 'TERMINADA').length;

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [fechaObjetivo, setFechaObjetivo] = useState('');
  const [montoFijo, setMontoFijo] = useState('');
  const [cargado, setCargado] = useState(false);
  const [facturando, setFacturando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hito && !cargado) {
      setNombre(hito.nombre);
      setFechaObjetivo(hito.fechaObjetivo ? hito.fechaObjetivo.slice(0, 10) : '');
      setMontoFijo(hito.montoFijo != null ? String(hito.montoFijo) : '');
      setCargado(true);
    }
  }, [hito, cargado]);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
  }

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/admin/proyectos/hitos/${hitoId}`, {
        nombre,
        fechaObjetivo: fechaObjetivo || undefined,
        montoFijo: montoFijo !== '' ? Number(montoFijo) : undefined,
      }),
    onSuccess: () => {
      invalidar();
      confirmarGuardado();
      setEditando(false);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el hito.')),
  });

  const cambiarEstado = useMutation({
    mutationFn: async (estado: string) => apiClient.patch(`/admin/proyectos/hitos/${hitoId}`, { estado }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cambiar el estado del hito.')),
  });

  const facturarHito = useMutation({
    mutationFn: async () => (await apiClient.post<{ facturaId: string; numero: string | null; total: string }>(`/admin/proyectos/hitos/${hitoId}/facturar`)).data,
    onSuccess: () => {
      invalidar();
      setFacturando(false);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo facturar el hito.')),
  });

  const eliminarHito = useMutation({
    mutationFn: async () => apiClient.delete(`/admin/proyectos/hitos/${hitoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
      navigate(`/proyectos/${proyectoId}/hitos`);
    },
    onError: (err) => {
      setError(mensajeErrorApi(err, 'No se pudo eliminar el hito.'));
      setEliminando(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError('Ingresá un nombre.');
      return;
    }
    guardar.mutate();
  }

  const [hayCambiosForm, confirmarGuardado] = useHayCambios({ nombre, fechaObjetivo, montoFijo }, cargado);
  const haycambios = editando && hayCambiosForm;
  const puedeEditar = tienePermiso('proyectos.editar');

  if (!proyecto || !hito) {
    return (
      <PaginaDocumento titulo="Hito" rutaVolver={`/proyectos/${proyectoId}/hitos`} etiquetaVolver="Volver a Hitos" haycambios={false} resumen={null} acciones={null}>
        <p className="text-sm text-slate-400">Cargando…</p>
      </PaginaDocumento>
    );
  }

  return (
    <PaginaDocumento
      titulo={hito.nombre}
      rutaVolver={`/proyectos/${proyectoId}/hitos`}
      etiquetaVolver="Volver a Hitos"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
            {puedeEditar ? (
              <Select value={hito.estado} onChange={(e) => cambiarEstado.mutate(e.target.value)} disabled={!!hito.facturaId || cambiarEstado.isPending} className="text-sm">
                {ESTADOS_HITO.map((estado) => (
                  <option key={estado} value={estado}>
                    {ETIQUETA_ESTADO_HITO[estado]}
                  </option>
                ))}
              </Select>
            ) : (
              <Badge>{ETIQUETA_ESTADO_HITO[hito.estado]}</Badge>
            )}
          </div>
          {hito.montoFijo && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Monto fijo</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {Number(hito.montoFijo).toLocaleString('es-DO')}</span>
            </div>
          )}
          {hito.facturaId && <p className="text-xs text-slate-400">Ya facturado — para revertirlo, anular la factura desde Facturación.</p>}
        </>
      }
      acciones={
        editando ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" form="form-hito-ver" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {puedeEditar && (
              <Button type="button" className="w-full" onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
            {!hito.facturaId && tienePermiso('proyectos.facturar') && (
              <Button type="button" variante="secundario" className="w-full" onClick={() => setFacturando(true)}>
                Facturar
              </Button>
            )}
            {puedeEditar && (
              <Button type="button" variante="peligro" className="w-full" onClick={() => setEliminando(true)}>
                Eliminar
              </Button>
            )}
            <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(`/proyectos/${proyectoId}/hitos`)}>
              Volver
            </Button>
          </>
        )
      }
    >
      {editando ? (
        <form id="form-hito-ver" onSubmit={onSubmit} className="space-y-3">
          <Card titulo="Datos del hito">
            <div className="sm:col-span-2">
              <FormField id="hito-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <FormField id="hito-fecha-objetivo" label="Fecha objetivo (opcional)" type="date" value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} />
            <FormField
              id="hito-monto-fijo"
              label="Monto fijo (opcional — solo si el proyecto factura a precio fijo)"
              type="number"
              min="0"
              value={montoFijo}
              onChange={(e) => setMontoFijo(e.target.value)}
            />
          </Card>
        </form>
      ) : (
        <Card titulo="Tareas">
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
              {tareasDelHito.length > 0 ? `${terminadas}/${tareasDelHito.length} tarea(s) terminada(s)` : 'Sin tareas asignadas a este hito todavía.'}
            </p>
            {tareasDelHito.length > 0 && (
              <div className="space-y-1.5">
                {tareasDelHito.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 text-sm dark:border-slate-800">
                    {t.estado === 'TERMINADA' ? <CheckCircle2 size={15} className="shrink-0 text-emerald-500" /> : <Circle size={15} className="shrink-0 text-slate-300 dark:text-slate-600" />}
                    <span className={clsx('flex-1 truncate', t.estado === 'TERMINADA' && 'text-slate-400 line-through')}>{t.titulo}</span>
                    <span className="shrink-0 text-xs text-slate-400">{ETIQUETA_ESTADO_TAREA[t.estado]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {facturando && (
        <RequierePermiso permiso="proyectos.facturar">
          <FacturarHitoModal hitoId={hito.id} confirmando={facturarHito.isPending} onConfirmar={() => facturarHito.mutate()} onCancelar={() => setFacturando(false)} />
        </RequierePermiso>
      )}

      {eliminando && (
        <ConfirmModal
          titulo="¿Eliminar este hito?"
          descripcion={
            <>
              Se eliminará <b>{hito.nombre}</b> y las tareas que lo tengan asignado quedarán sin hito.
              {hito.facturaId && <p className="mt-2 text-amber-600 dark:text-amber-400">Este hito ya tiene una factura generada — eliminarlo no anula esa factura, solo el hito.</p>}
            </>
          }
          confirmando={eliminarHito.isPending}
          onConfirmar={() => eliminarHito.mutate()}
          onCancelar={() => setEliminando(false)}
        />
      )}
    </PaginaDocumento>
  );
}
