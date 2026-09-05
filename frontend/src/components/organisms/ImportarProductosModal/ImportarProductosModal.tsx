import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { parsearYValidarExcelProductos, FilaProductoImportada } from '../../../lib/importar-productos-excel';

interface ResumenImportacion {
  creados: number;
  actualizados: number;
  errores: { codigo: string; mensaje: string }[];
}

function mensajeError(err: unknown, fallback: string): string {
  const mensaje =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
      : undefined;
  return mensaje ?? (err instanceof Error ? err.message : fallback);
}

/**
 * Import masivo de catálogo (Fase 3e de adopción de Cuadre): el .xlsx se
 * parsea y valida 100% en el navegador (`parsearYValidarExcelProductos`)
 * antes de mandar nada — recién al confirmar se envía el arreglo ya
 * validado como JSON a POST /productos/importar (sin multer, mismo
 * criterio que CampoImagen). No soporta COMBOs, variantes reales de
 * Talla/Color ni stock — ver ARCHITECTURE.md.
 */
export function ImportarProductosModal({ onImportado }: { onImportado: () => void }) {
  const [filas, setFilas] = useState<FilaProductoImportada[] | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setResumen(null);
    setErrorArchivo(null);
    setFilas(null);
    try {
      const parseadas = await parsearYValidarExcelProductos(archivo);
      setFilas(parseadas);
    } catch (err) {
      setErrorArchivo(mensajeError(err, 'No se pudo leer el archivo — ¿es un .xlsx válido?'));
    }
  }

  const importar = useMutation({
    mutationFn: async () => {
      const productos = (filas ?? []).map((f) => ({
        codigo: f.codigo,
        nombre: f.nombre,
        categoria: f.categoria,
        tipo: f.tipo as 'PRODUCTO' | 'SERVICIO' | undefined,
        unidadMedida: f.unidadMedida,
        porcentajeItbis: f.porcentajeItbis,
        precioGeneral: f.precioGeneral,
        codigoBarras: f.codigoBarras,
      }));
      return (await apiClient.post<ResumenImportacion>('/productos/importar', { productos })).data;
    },
    onSuccess: (data) => {
      setResumen(data);
      onImportado();
    },
    onError: (err: unknown) => setErrorArchivo(mensajeError(err, 'No se pudo importar el archivo.')),
  });

  const filasConError = filas?.filter((f) => f.errores.length > 0) ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Subí un .xlsx con columnas <strong>Código</strong> y <strong>Nombre</strong> (mismas columnas que exporta "Exportar
        Excel"). No se soportan productos COMBO, variantes de Talla/Color ni stock — esos se administran desde sus propias
        pantallas.
      </p>

      <input
        type="file"
        accept=".xlsx"
        onChange={elegirArchivo}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sol-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-sol-700 hover:file:bg-sol-100 dark:text-slate-300 dark:file:bg-sol-900/30 dark:file:text-sol-300"
      />

      {errorArchivo && <p className="text-sm text-red-600">{errorArchivo}</p>}

      {filas && filas.length === 0 && <p className="text-sm text-amber-700 dark:text-amber-400">El archivo no tiene ninguna fila de datos.</p>}

      {filas && filas.length > 0 && !resumen && (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {filas.length} fila(s) — {filasConError.length > 0 ? (
              <span className="font-medium text-red-600">{filasConError.length} con error(es), corregí el archivo y volvé a subirlo</span>
            ) : (
              <span className="font-medium text-emerald-600">todas válidas</span>
            )}
          </p>

          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Precio GENERAL</th>
                  <th className="px-3 py-2 font-medium">Errores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filas.map((f, i) => (
                  <tr key={i} className={f.errores.length > 0 ? 'bg-red-50 dark:bg-red-950/30' : undefined}>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.codigo || '—'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.nombre || '—'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.categoria ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.tipo ?? 'PRODUCTO'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{f.precioGeneral ?? '—'}</td>
                    <td className="px-3 py-2 text-red-600">{f.errores.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            disabled={filasConError.length > 0 || importar.isPending}
            onClick={() => importar.mutate()}
          >
            {importar.isPending ? 'Importando…' : `Confirmar importación (${filas.length} fila(s))`}
          </Button>
        </>
      )}

      {resumen && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="flex gap-2">
            <Badge tono="exito">{resumen.creados} creado(s)</Badge>
            <Badge tono="neutro">{resumen.actualizados} actualizado(s)</Badge>
            {resumen.errores.length > 0 && <Badge tono="peligro">{resumen.errores.length} error(es)</Badge>}
          </div>
          {resumen.errores.length > 0 && (
            <ul className="space-y-1 text-xs text-red-600">
              {resumen.errores.map((e, i) => (
                <li key={i}>
                  {e.codigo}: {e.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
