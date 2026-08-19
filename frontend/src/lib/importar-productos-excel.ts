export interface FilaProductoImportada {
  codigo: string;
  nombre: string;
  categoria?: string;
  tipo?: string;
  unidadMedida?: string;
  porcentajeItbis?: number;
  precioGeneral?: number;
  codigoBarras?: string;
  errores: string[];
}

/** Mismos encabezados que produce GET /productos/exportar — "Stock total" se ignora a propósito (no es importable, ver ARCHITECTURE.md). */
const COLUMNAS: Record<string, keyof Omit<FilaProductoImportada, 'errores'>> = {
  'código': 'codigo',
  'codigo': 'codigo',
  'nombre': 'nombre',
  'categoría': 'categoria',
  'categoria': 'categoria',
  'tipo': 'tipo',
  'unidad': 'unidadMedida',
  'itbis %': 'porcentajeItbis',
  'precio general': 'precioGeneral',
  'código de barras': 'codigoBarras',
  'codigo de barras': 'codigoBarras',
};

function normalizarEncabezado(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

function celdaTexto(valor: unknown): string | undefined {
  const texto = String(valor ?? '').trim();
  return texto || undefined;
}

function celdaNumero(valor: unknown): number | undefined {
  if (valor === null || valor === undefined || valor === '') return undefined;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : NaN;
}

/**
 * Parsea el .xlsx en el navegador (ExcelJS, ya usado en el backend para
 * generar reportes — se evitó la dependencia `xlsx`/SheetJS de npm
 * porque la versión publicada ahí (0.18.5) tiene vulnerabilidades
 * conocidas sin parche en el registro; ExcelJS no las tiene y ya está
 * vetada en el proyecto) y valida cada fila ANTES de mandar nada al
 * backend — mismo criterio que la vista previa de cualquier import
 * masivo: errores visibles y corregibles antes de confirmar. Import
 * dinámico a propósito: ExcelJS pesa ~1MB minificado y solo hace falta
 * para quien realmente abre "Importar Excel" — cargarlo top-level
 * infla el bundle principal para todo el mundo.
 */
export async function parsearYValidarExcelProductos(archivo: File): Promise<FilaProductoImportada[]> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await archivo.arrayBuffer()) as never);
  const hoja = workbook.worksheets[0];
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja');

  const encabezados = new Map<number, keyof Omit<FilaProductoImportada, 'errores'>>();
  hoja.getRow(1).eachCell((celda, colNumero) => {
    const columna = COLUMNAS[normalizarEncabezado(celda.value)];
    if (columna) encabezados.set(colNumero, columna);
  });
  if (![...encabezados.values()].includes('codigo') || ![...encabezados.values()].includes('nombre')) {
    throw new Error('El archivo debe tener al menos las columnas "Código" y "Nombre"');
  }

  const filas: FilaProductoImportada[] = [];
  for (let i = 2; i <= hoja.rowCount; i++) {
    const fila = hoja.getRow(i);
    if (fila.cellCount === 0 || fila.actualCellCount === 0) continue;

    const datos: Partial<Record<keyof Omit<FilaProductoImportada, 'errores'>, unknown>> = {};
    encabezados.forEach((columna, colNumero) => {
      datos[columna] = fila.getCell(colNumero).value;
    });

    const porcentajeItbis = celdaNumero(datos.porcentajeItbis);
    const precioGeneral = celdaNumero(datos.precioGeneral);
    const filaProducto: FilaProductoImportada = {
      codigo: celdaTexto(datos.codigo) ?? '',
      nombre: celdaTexto(datos.nombre) ?? '',
      categoria: celdaTexto(datos.categoria),
      tipo: celdaTexto(datos.tipo)?.toUpperCase(),
      unidadMedida: celdaTexto(datos.unidadMedida),
      porcentajeItbis,
      precioGeneral,
      codigoBarras: celdaTexto(datos.codigoBarras),
      errores: [],
    };

    if (!filaProducto.codigo) filaProducto.errores.push('Código vacío');
    if (!filaProducto.nombre) filaProducto.errores.push('Nombre vacío');
    if (filaProducto.tipo && !['PRODUCTO', 'SERVICIO'].includes(filaProducto.tipo)) {
      filaProducto.errores.push(
        filaProducto.tipo === 'COMBO' ? 'Tipo COMBO no soportado por la importación masiva' : `Tipo "${filaProducto.tipo}" inválido`,
      );
    }
    if (porcentajeItbis !== undefined && (Number.isNaN(porcentajeItbis) || porcentajeItbis < 0 || porcentajeItbis > 100)) {
      filaProducto.errores.push('ITBIS % inválido (debe ser un número entre 0 y 100)');
    }
    if (precioGeneral !== undefined && (Number.isNaN(precioGeneral) || precioGeneral < 0)) {
      filaProducto.errores.push('Precio GENERAL inválido (debe ser un número mayor o igual a 0)');
    }

    filas.push(filaProducto);
  }

  const codigosVistos = new Set<string>();
  for (const fila of filas) {
    if (!fila.codigo) continue;
    if (codigosVistos.has(fila.codigo)) fila.errores.push('Código duplicado dentro del archivo');
    codigosVistos.add(fila.codigo);
  }

  return filas;
}
