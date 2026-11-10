import { comprimirImagen } from './comprimir-imagen';

/**
 * Benchmark 2026-11-09 (Fase 10) — a diferencia de `comprimirImagen` (foto
 * de producto, reconocimiento visual, 640px alcanza), una factura necesita
 * texto LEGIBLE para que la IA pueda leer montos/NCF con precisión — acá
 * se usa una dimensión mayor y más calidad. Un PDF no pasa por canvas (no
 * es una imagen): se lee tal cual, sin comprimir.
 */
export function archivoADataUri(archivo: File): Promise<string> {
  if (archivo.type === 'application/pdf') {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      lector.onload = () => resolve(lector.result as string);
      lector.readAsDataURL(archivo);
    });
  }
  return comprimirImagen(archivo, 2000, 0.85);
}
