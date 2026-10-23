import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { abrirBlob } from '../../../lib/descargar-archivo';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import {
  BLOQUES_TERMICO_DEFECTO,
  BloqueTermico,
  ClaveCampoDocumento,
  ETIQUETA_BLOQUE_TERMICO,
  TipoBloqueTermico,
} from '../../../types/layout-documento';

interface EditorLayoutTermicoProps {
  tipoDocumento: 'FACTURA' | 'COTIZACION' | 'REMISION' | 'ORDEN_COMPRA';
  bloquesGuardados: BloqueTermico[] | null;
  onCerrar: () => void;
}

/**
 * "Formato de Documentos" Fase G — editor del ticket térmico (80mm/58mm).
 * A propósito MUCHO más simple que `EditorLayoutDocumento` (el de Carta/
 * A4): acá no hay posición libre x/y — un ticket es un rollo continuo sin
 * alto fijo, y demasiado angosto para columnas lado a lado. El layout es
 * una lista ordenada (el orden ES el orden de impresión), con flechas
 * para reordenar en vez de arrastrar.
 */
export function EditorLayoutTermico({ tipoDocumento, bloquesGuardados, onCerrar }: EditorLayoutTermicoProps) {
  const queryClient = useQueryClient();
  const [bloques, setBloques] = useState<BloqueTermico[]>(bloquesGuardados ?? BLOQUES_TERMICO_DEFECTO);
  const [error, setError] = useState<string | null>(null);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [anchoPreview, setAnchoPreview] = useState<'TERMICA_80MM' | 'TERMICA_58MM'>('TERMICA_80MM');

  const { data: camposDisponibles } = useQuery({
    queryKey: ['campos-documento', tipoDocumento],
    queryFn: async () =>
      (
        await apiClient.get<{ clave: ClaveCampoDocumento; etiqueta: string }[]>('/admin/personalizacion-documentos/campos-disponibles', {
          params: { tipo: tipoDocumento },
        })
      ).data,
  });

  const tiposDisponibles = (Object.keys(ETIQUETA_BLOQUE_TERMICO) as TipoBloqueTermico[]).filter(
    (t) => t === 'campo' || !bloques.some((b) => b.tipo === t),
  );

  function agregarBloque(tipo: TipoBloqueTermico) {
    setBloques((prev) => [...prev, tipo === 'campo' ? { tipo, campo: 'numero' } : { tipo }]);
  }

  function eliminarBloque(i: number) {
    setBloques((prev) => prev.filter((_, idx) => idx !== i));
  }

  function mover(i: number, direccion: -1 | 1) {
    setBloques((prev) => {
      const destino = i + direccion;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[i], copia[destino]] = [copia[destino], copia[i]];
      return copia;
    });
  }

  function actualizarBloque(i: number, cambios: Partial<BloqueTermico>) {
    setBloques((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...cambios } : b)));
  }

  const guardar = useMutation({
    mutationFn: async () => apiClient.put(`/admin/personalizacion-documentos/${tipoDocumento}/layout-termico`, { bloques }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['formato-documentos'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el diseño del ticket.')),
  });

  const quitarLayout = useMutation({
    mutationFn: async () => apiClient.put(`/admin/personalizacion-documentos/${tipoDocumento}/layout-termico`, { bloques: [] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formato-documentos'] });
      onCerrar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo quitar el diseño del ticket.')),
  });

  async function previsualizar() {
    setPrevisualizando(true);
    setError(null);
    try {
      const respuesta = await apiClient.get(`/admin/personalizacion-documentos/${tipoDocumento}/preview`, {
        params: { formato: anchoPreview },
        responseType: 'blob',
      });
      abrirBlob(new Blob([respuesta.data], { type: 'text/html' }));
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo generar la vista previa.'));
    } finally {
      setPrevisualizando(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        El ticket es un rollo angosto sin alto fijo — acá se arma como una lista, de arriba hacia abajo, en vez de arrastrar bloques en un
        canvas.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value=""
          onChange={(e) => {
            if (e.target.value) agregarBloque(e.target.value as TipoBloqueTermico);
          }}
          className="w-52"
        >
          <option value="">+ Agregar bloque…</option>
          {tiposDisponibles.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_BLOQUE_TERMICO[t]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        {bloques.map((bloque, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {i + 1}. {bloque.tipo === 'campo' ? (camposDisponibles?.find((c) => c.clave === bloque.campo)?.etiqueta ?? 'Campo suelto') : ETIQUETA_BLOQUE_TERMICO[bloque.tipo]}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
                  title="Subir"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === bloques.length - 1}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
                  title="Bajar"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => eliminarBloque(i)}
                  className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  title="Quitar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {bloque.tipo === 'campo' && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select value={bloque.campo ?? 'numero'} onChange={(e) => actualizarBloque(i, { campo: e.target.value as ClaveCampoDocumento })}>
                  {camposDisponibles?.map((c) => (
                    <option key={c.clave} value={c.clave}>
                      {c.etiqueta}
                    </option>
                  ))}
                </Select>
                <input
                  value={bloque.etiqueta ?? ''}
                  onChange={(e) => actualizarBloque(i, { etiqueta: e.target.value })}
                  placeholder='Prefijo opcional, ej: "Mesa:"'
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )}
          </div>
        ))}
        {bloques.length === 0 && <p className="text-sm text-slate-400">Sin bloques — el ticket no imprimiría nada. Agregá alguno arriba.</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar diseño de ticket'}
        </Button>
        <Select value={anchoPreview} onChange={(e) => setAnchoPreview(e.target.value as 'TERMICA_80MM' | 'TERMICA_58MM')} className="w-32">
          <option value="TERMICA_80MM">80mm</option>
          <option value="TERMICA_58MM">58mm</option>
        </Select>
        <Button type="button" variante="secundario" onClick={previsualizar} disabled={previsualizando}>
          {previsualizando ? 'Generando…' : 'Vista previa'}
        </Button>
        <button
          type="button"
          onClick={() => quitarLayout.mutate()}
          disabled={quitarLayout.isPending}
          className="text-xs text-red-600 hover:underline dark:text-red-400"
        >
          Quitar diseño personalizado (volver al ticket fijo)
        </button>
        <Button type="button" variante="secundario" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
