import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Button } from '../../components/atoms/Button/Button';
import { Select } from '../../components/atoms/Select/Select';
import { FormField } from '../../components/molecules/FormField/FormField';
import { useHayCambios } from '../../hooks/useHayCambios';
import { FORMATOS_IMPRESION } from '../../constants/formato-impresion';
import { PLANTILLAS_DOCUMENTO } from '../../constants/plantilla-documento';
import { METODOS_APERTURA_CAJA } from '../../constants/metodo-apertura-caja';
import type { Bodega } from '../../components/organisms/StockBodegasPanel/StockBodegasPanel';

interface Sucursal {
  id: string;
  nombre: string;
}

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalEditarBodega de StockBodegasPanel.tsx. Sin endpoint individual: usa la lista completa (`/todas`, siempre corta) para editar. */
export function BodegaVer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas', true],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas/todas')).data,
  });
  const bodega = bodegas?.find((b) => b.id === id);

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [activa, setActiva] = useState(true);
  const [formatoImpresion, setFormatoImpresion] = useState('');
  const [plantillaDocumento, setPlantillaDocumento] = useState('');
  const [metodoAperturaCaja, setMetodoAperturaCaja] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (bodega && !cargado) {
      setNombre(bodega.nombre);
      setDireccion(bodega.direccion ?? '');
      setSucursalId(bodega.sucursalId);
      setActiva(bodega.activa);
      setFormatoImpresion(bodega.formatoImpresion ?? '');
      setPlantillaDocumento(bodega.plantillaDocumento ?? '');
      setMetodoAperturaCaja(bodega.metodoAperturaCaja ?? '');
      setCargado(true);
    }
  }, [bodega, cargado]);

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => (await apiClient.get<Sucursal[]>('/sucursales')).data,
  });

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/inventario/bodegas/${id}`, {
        nombre,
        direccion: direccion || undefined,
        sucursalId,
        activa,
        formatoImpresion: formatoImpresion || null,
        plantillaDocumento: plantillaDocumento || null,
        metodoAperturaCaja: metodoAperturaCaja || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodegas'] });
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de guardar bien.
      confirmarGuardado();
      setTimeout(() => navigate('/inventario/stock'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la bodega.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios(
    { nombre, direccion, sucursalId, activa, formatoImpresion, plantillaDocumento, metodoAperturaCaja },
    cargado,
  );

  return (
    <PaginaDocumento
      titulo={bodega ? `Bodega — ${bodega.nombre}` : 'Bodega'}
      rutaVolver="/inventario/stock"
      etiquetaVolver="Volver a Stock"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{nombre || '—'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-ver-bodega" disabled={guardar.isPending} className="w-full">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/inventario/stock')}>
            Volver
          </Button>
        </>
      }
    >
      {!bodega ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form id="form-ver-bodega" onSubmit={onSubmit} className="space-y-3">
          <Card titulo="Información de la bodega">
            <FormField id="editar-bodega-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            <FormField id="editar-bodega-direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            <div className="flex flex-col gap-1">
              <label htmlFor="editar-bodega-sucursal" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Sucursal
              </label>
              <Select id="editar-bodega-sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
                {sucursales?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Formato de impresión</label>
              <Select value={formatoImpresion} onChange={(e) => setFormatoImpresion(e.target.value)}>
                <option value="">Usar el default de la empresa</option>
                {FORMATOS_IMPRESION.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Diseño del documento</label>
              <Select value={plantillaDocumento} onChange={(e) => setPlantillaDocumento(e.target.value)}>
                <option value="">Usar el default de la empresa</option>
                {PLANTILLAS_DOCUMENTO.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Apertura de caja registradora</label>
              <Select value={metodoAperturaCaja} onChange={(e) => setMetodoAperturaCaja(e.target.value)}>
                <option value="">Usar el default de la empresa</option>
                {METODOS_APERTURA_CAJA.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
              <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
              Bodega activa
            </label>
            {!activa && (
              <p className="text-xs text-amber-600 dark:text-amber-400 sm:col-span-2">
                Inactivarla la saca de los selectores de bodega en toda la app (Facturación, Compras, POS, etc.) — no borra su stock ni su historial.
              </p>
            )}
          </Card>
        </form>
      )}
    </PaginaDocumento>
  );
}
