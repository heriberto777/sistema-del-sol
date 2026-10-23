import { useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { abrirBlob } from '../../../lib/descargar-archivo';
import { Button } from '../../atoms/Button/Button';
import { Select } from '../../atoms/Select/Select';
import { CampoImagen } from '../../molecules/CampoImagen/CampoImagen';
import { BloqueLayout, CampoEmisorCliente, ClaveCampoDocumento, ColumnaLinea, ETIQUETA_BLOQUE, FilaTotal, TipoBloque } from '../../../types/layout-documento';
import { LAYOUTS_PRESET } from '../../../constants/layouts-documento-presets';

const ANCHO_CANVAS = 480;
const ALTO_CANVAS = Math.round((ANCHO_CANVAS * 11) / 8.5);

const BLOQUE_POR_DEFECTO: Record<TipoBloque, Omit<BloqueLayout, 'tipo'>> = {
  logo: { x: 5, y: 4, w: 20, h: 8 },
  datos_empresa: { x: 5, y: 15, w: 44, h: 12 },
  datos_cliente: { x: 51, y: 15, w: 44, h: 12 },
  encabezado: { x: 5, y: 4, w: 44, h: 10 },
  tabla_lineas: { x: 5, y: 30, w: 90, h: 30 },
  totales: { x: 55, y: 70, w: 40, h: 14 },
  qr: { x: 5, y: 70, w: 15, h: 15 },
  firma: { x: 25, y: 70, w: 28, h: 14 },
  texto_legal: { x: 5, y: 92, w: 90, h: 6 },
  imagen_libre: { x: 5, y: 50, w: 20, h: 20, imagen: '' },
  campo: { x: 5, y: 60, w: 40, h: 6, campo: 'numero', etiqueta: '' },
};

interface EditorLayoutDocumentoProps {
  tipoDocumento: 'FACTURA' | 'COTIZACION' | 'REMISION' | 'ORDEN_COMPRA';
  bloquesGuardados: BloqueLayout[] | null;
  onCerrar: () => void;
}

export function EditorLayoutDocumento({ tipoDocumento, bloquesGuardados, onCerrar }: EditorLayoutDocumentoProps) {
  const queryClient = useQueryClient();
  const [bloques, setBloques] = useState<BloqueLayout[]>(bloquesGuardados ?? []);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previsualizando, setPrevisualizando] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const { data: camposDisponibles } = useQuery({
    // Fase F — filtrado por tipo de documento, para no ofrecer en Cotización/Remisión/Orden de Compra campos exclusivos de Factura (NCF, forma de pago, etc.).
    queryKey: ['campos-documento', tipoDocumento],
    queryFn: async () =>
      (
        await apiClient.get<{ clave: ClaveCampoDocumento; etiqueta: string }[]>('/admin/personalizacion-documentos/campos-disponibles', {
          params: { tipo: tipoDocumento },
        })
      ).data,
  });

  const tiposDisponibles = (Object.keys(ETIQUETA_BLOQUE) as TipoBloque[]).filter(
    (t) => t === 'imagen_libre' || t === 'campo' || !bloques.some((b) => b.tipo === t),
  );

  function agregarBloque(tipo: TipoBloque) {
    setBloques((prev) => [...prev, { tipo, ...BLOQUE_POR_DEFECTO[tipo] }]);
    setSeleccionado(bloques.length);
  }

  function eliminarBloque(i: number) {
    setBloques((prev) => prev.filter((_, idx) => idx !== i));
    setSeleccionado(null);
  }

  function actualizarBloque(i: number, cambios: Partial<BloqueLayout>) {
    setBloques((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...cambios } : b)));
  }

  function cargarPreset(preset: keyof typeof LAYOUTS_PRESET) {
    setBloques(LAYOUTS_PRESET[preset].map((b) => ({ ...b })));
    setSeleccionado(null);
  }

  const guardar = useMutation({
    mutationFn: async () => apiClient.put(`/admin/personalizacion-documentos/${tipoDocumento}/layout`, { bloques }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['formato-documentos'] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el layout.')),
  });

  const quitarLayout = useMutation({
    mutationFn: async () => apiClient.put(`/admin/personalizacion-documentos/${tipoDocumento}/layout`, { bloques: [] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formato-documentos'] });
      onCerrar();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo quitar el layout.')),
  });

  async function previsualizar() {
    setPrevisualizando(true);
    setError(null);
    try {
      const respuesta = await apiClient.get(`/admin/personalizacion-documentos/${tipoDocumento}/preview`, { responseType: 'blob' });
      abrirBlob(new Blob([respuesta.data], { type: 'application/pdf' }));
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo generar la vista previa.'));
    } finally {
      setPrevisualizando(false);
    }
  }

  if (bloques.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">Elegí un diseño de partida para empezar a ajustar — después podés mover y redimensionar cualquier bloque.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(Object.keys(LAYOUTS_PRESET) as (keyof typeof LAYOUTS_PRESET)[]).map((preset) => (
            <button
              key={preset}
              onClick={() => cargarPreset(preset)}
              className="rounded-lg border border-slate-300 px-3 py-4 text-sm font-medium text-slate-700 hover:border-sol-500 hover:bg-sol-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {ETIQUETA_PRESET[preset]}
            </button>
          ))}
        </div>
        <Button variante="secundario" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    );
  }

  const bloqueSeleccionado = seleccionado !== null ? bloques[seleccionado] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value=""
          onChange={(e) => {
            if (e.target.value) agregarBloque(e.target.value as TipoBloque);
          }}
          className="w-52"
        >
          <option value="">+ Agregar bloque…</option>
          {tiposDisponibles.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_BLOQUE[t]}
            </option>
          ))}
        </Select>
        <span className="text-xs text-slate-400">Arrastrá para mover, tirá de la esquina para redimensionar.</span>
      </div>

      <div className="flex flex-wrap gap-5">
        <div
          ref={canvasRef}
          className="relative shrink-0 rounded-md border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950"
          style={{ width: ANCHO_CANVAS, height: ALTO_CANVAS }}
          onClick={(e) => {
            // Solo deseleccionar si el clic fue directo sobre el fondo del canvas —
            // un clic sobre un bloque también dispara este onClick al burbujear
            // (el stopPropagation del onMouseDown del bloque no frena el click
            // posterior), así que sin este chequeo la selección se perdía apenas
            // se elegía un bloque.
            if (e.target === e.currentTarget) setSeleccionado(null);
          }}
        >
          {bloques.map((bloque, i) => (
            <Rnd
              key={i}
              bounds="parent"
              size={{ width: (bloque.w / 100) * ANCHO_CANVAS, height: (bloque.h / 100) * ALTO_CANVAS }}
              position={{ x: (bloque.x / 100) * ANCHO_CANVAS, y: (bloque.y / 100) * ALTO_CANVAS }}
              onDragStop={(_e, d) => actualizarBloque(i, { x: (d.x / ANCHO_CANVAS) * 100, y: (d.y / ALTO_CANVAS) * 100 })}
              onResizeStop={(_e, _dir, ref, _delta, pos) =>
                actualizarBloque(i, {
                  w: (ref.offsetWidth / ANCHO_CANVAS) * 100,
                  h: (ref.offsetHeight / ALTO_CANVAS) * 100,
                  x: (pos.x / ANCHO_CANVAS) * 100,
                  y: (pos.y / ALTO_CANVAS) * 100,
                })
              }
              className={
                seleccionado === i
                  ? 'z-10 border-2 border-sol-500 bg-sol-50/70 dark:bg-sol-900/30'
                  : 'border border-dashed border-slate-300 bg-slate-50/70 dark:border-slate-600 dark:bg-slate-800/40'
              }
            >
              <div
                className="flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden px-1 text-center"
                onClick={(e) => {
                  e.stopPropagation();
                  setSeleccionado(i);
                }}
              >
                <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm dark:bg-slate-900/90 dark:text-slate-300">
                  {bloque.tipo === 'campo'
                    ? (camposDisponibles?.find((c) => c.clave === bloque.campo)?.etiqueta ?? ETIQUETA_BLOQUE.campo)
                    : ETIQUETA_BLOQUE[bloque.tipo]}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    eliminarBloque(i);
                  }}
                  className="absolute right-1 top-1 rounded bg-white/90 p-0.5 text-red-500 shadow-sm hover:bg-red-50 dark:bg-slate-900/90"
                  title="Eliminar bloque"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </Rnd>
          ))}
        </div>

        <div className="min-w-[220px] flex-1 space-y-3">
          {bloqueSeleccionado ? (
            <PropiedadesBloque
              bloque={bloqueSeleccionado}
              onChange={(cambios) => actualizarBloque(seleccionado!, cambios)}
              camposDisponibles={camposDisponibles ?? []}
              tipoDocumento={tipoDocumento}
            />
          ) : (
            <p className="text-sm text-slate-400">Hacé clic en un bloque para ver sus opciones.</p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar layout'}
        </Button>
        <Button type="button" variante="secundario" onClick={previsualizar} disabled={previsualizando}>
          {previsualizando ? 'Generando…' : 'Vista previa'}
        </Button>
        <button
          type="button"
          onClick={() => quitarLayout.mutate()}
          disabled={quitarLayout.isPending}
          className="text-xs text-red-600 hover:underline dark:text-red-400"
        >
          Quitar layout personalizado (volver a la plantilla fija)
        </button>
      </div>
    </div>
  );
}

const ETIQUETA_PRESET: Record<keyof typeof LAYOUTS_PRESET, string> = {
  CLASICO: 'Clásico',
  ECF_OFICIAL: 'eCF Oficial',
  MINIMALISTA: 'Minimalista',
  COMPACTO: 'Compacto',
  EDITORIAL: 'Editorial',
};

const CAMPOS_EMPRESA: { value: CampoEmisorCliente; label: string }[] = [
  { value: 'rnc', label: 'RNC' },
  { value: 'direccion', label: 'Dirección' },
  { value: 'telefono', label: 'Teléfono' },
];
const CAMPOS_CLIENTE: { value: CampoEmisorCliente; label: string }[] = [
  { value: 'rnc', label: 'RNC/Cédula' },
  { value: 'direccion', label: 'Dirección' },
  { value: 'telefono', label: 'Teléfono' },
];
const COLUMNAS: { value: ColumnaLinea; label: string }[] = [
  { value: 'cantidad', label: 'Cantidad' },
  { value: 'precioUnitario', label: 'Precio unitario' },
  { value: 'total', label: 'Total' },
  { value: 'codigo', label: 'Código de producto' },
  { value: 'categoria', label: 'Categoría' },
  { value: 'unidadMedida', label: 'Unidad de medida' },
  { value: 'porcentajeItbis', label: '% ITBIS' },
  { value: 'descuentoLinea', label: 'Descuento' },
];
/** Default cuando `bloque.columnas` todavía no se tocó — las 3 de siempre, NO las 8 (las 5 nuevas son opt-in, ver columnasActivas() en el backend). */
const COLUMNAS_DEFAULT: ColumnaLinea[] = ['cantidad', 'precioUnitario', 'total'];
const FILAS: { value: FilaTotal; label: string }[] = [
  { value: 'subtotal', label: 'Subtotal' },
  { value: 'descuento', label: 'Descuento' },
  { value: 'itbis', label: 'ITBIS' },
  { value: 'total', label: 'Total' },
];

function PropiedadesBloque({
  bloque,
  onChange,
  camposDisponibles,
  tipoDocumento,
}: {
  bloque: BloqueLayout;
  onChange: (cambios: Partial<BloqueLayout>) => void;
  camposDisponibles: { clave: ClaveCampoDocumento; etiqueta: string }[];
  tipoDocumento: 'FACTURA' | 'COTIZACION' | 'REMISION' | 'ORDEN_COMPRA';
}) {
  function alternar<T extends string>(lista: T[] | undefined, valor: T, todas: T[]): T[] {
    const actual = lista ?? todas;
    return actual.includes(valor) ? actual.filter((v) => v !== valor) : [...actual, valor];
  }

  // Remisión nunca muestra precios (mostrarPrecios:false en el backend) — ofrecer precio/ITBIS/descuento ahí sería un checkbox que no hace nada.
  const columnasDisponibles = tipoDocumento === 'REMISION' ? COLUMNAS.filter((c) => c.value === 'cantidad' || c.value === 'codigo' || c.value === 'categoria' || c.value === 'unidadMedida') : COLUMNAS;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{ETIQUETA_BLOQUE[bloque.tipo]}</p>

      {(bloque.tipo === 'datos_empresa' || bloque.tipo === 'datos_cliente') && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Campos a mostrar</p>
          {(bloque.tipo === 'datos_empresa' ? CAMPOS_EMPRESA : CAMPOS_CLIENTE).map((c) => {
            const todas = (bloque.tipo === 'datos_empresa' ? CAMPOS_EMPRESA : CAMPOS_CLIENTE).map((x) => x.value);
            return (
              <label key={c.value} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={(bloque.campos ?? todas).includes(c.value)}
                  onChange={() => onChange({ campos: alternar(bloque.campos, c.value, todas) })}
                />
                {c.label}
              </label>
            );
          })}
        </div>
      )}

      {bloque.tipo === 'tabla_lineas' && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Columnas</p>
          {columnasDisponibles.map((c) => (
            <label key={c.value} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={(bloque.columnas ?? COLUMNAS_DEFAULT).includes(c.value)}
                onChange={() => onChange({ columnas: alternar(bloque.columnas, c.value, COLUMNAS_DEFAULT) })}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}

      {bloque.tipo === 'totales' && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Filas</p>
          {FILAS.map((f) => (
            <label key={f.value} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={(bloque.filas ?? FILAS.map((x) => x.value)).includes(f.value)}
                onChange={() => onChange({ filas: alternar(bloque.filas, f.value, FILAS.map((x) => x.value)) })}
              />
              {f.label}
            </label>
          ))}
        </div>
      )}

      {bloque.tipo === 'imagen_libre' && <CampoImagen valor={bloque.imagen || null} onChange={(valor) => onChange({ imagen: valor ?? '' })} label="Imagen" />}

      {bloque.tipo === 'campo' && (
        <div className="space-y-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Dato a mostrar</label>
            <Select value={bloque.campo ?? 'numero'} onChange={(e) => onChange({ campo: e.target.value as ClaveCampoDocumento })}>
              {camposDisponibles.map((c) => (
                <option key={c.clave} value={c.clave}>
                  {c.etiqueta}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Prefijo (opcional)</label>
            <input
              value={bloque.etiqueta ?? ''}
              onChange={(e) => onChange({ etiqueta: e.target.value })}
              placeholder='Ej: "Factura No."'
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <p className="text-xs text-slate-400">
            Si el documento no trae este dato (ej. Subtotal en una Remisión), el bloque queda vacío sin romper el diseño.
          </p>
        </div>
      )}

      {(bloque.tipo === 'logo' || bloque.tipo === 'encabezado' || bloque.tipo === 'qr' || bloque.tipo === 'firma' || bloque.tipo === 'texto_legal') && (
        <p className="text-xs text-slate-400">
          {bloque.tipo === 'qr' && 'Usa el QR configurado en la pestaña del formulario simple de este tipo de documento.'}
          {bloque.tipo === 'firma' && 'Usa la firma configurada en la pestaña del formulario simple de este tipo de documento.'}
          {bloque.tipo === 'texto_legal' && 'Usa el texto legal configurado en la pestaña del formulario simple de este tipo de documento.'}
          {(bloque.tipo === 'logo' || bloque.tipo === 'encabezado') && 'Solo posición y tamaño — sin opciones adicionales.'}
        </p>
      )}
    </div>
  );
}
