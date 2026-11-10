export interface FilaGastoMenorImportada {
  fecha?: string;
  cuentaBancaria: string;
  cuentaContable: string;
  concepto?: string;
  valor?: number;
  porcentajeItbis?: number;
  cantidad?: number;
  notas?: string;
  errores: string[];
}

const COLUMNAS: Record<string, keyof Omit<FilaGastoMenorImportada, 'errores'>> = {
  fecha: 'fecha',
  'cuenta bancaria': 'cuentaBancaria',
  banco: 'cuentaBancaria',
  'cuenta contable': 'cuentaContable',
  'cuenta de gasto': 'cuentaContable',
  concepto: 'concepto',
  valor: 'valor',
  monto: 'valor',
  'itbis %': 'porcentajeItbis',
  cantidad: 'cantidad',
  notas: 'notas',
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

function celdaFecha(valor: unknown): string | undefined {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return celdaTexto(valor);
}

/**
 * Fase 11.1 del benchmark (Cuadre tiene import masivo de Gastos que
 * alimenta el 606 directo) — mismo criterio que
 * `parsearYValidarExcelProductos`: parseo y validación 100% en el
 * navegador (ExcelJS, ya vetado `xlsx`/SheetJS por CVEs sin parche) antes
 * de mandar nada. Una fila = un gasto menor con UNA sola línea (el caso
 * real del mercado informal) — `cuentaBancaria`/`cuentaContable` quedan
 * como texto libre acá; el backend (`GastosMenoresService.importar`) los
 * resuelve contra el catálogo real del tenant, porque acá no hay forma de
 * saber qué existe sin pedírselo al backend por cada fila.
 */
export async function parsearYValidarExcelGastosMenores(archivo: File): Promise<FilaGastoMenorImportada[]> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await archivo.arrayBuffer()) as never);
  const hoja = workbook.worksheets[0];
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja');

  const encabezados = new Map<number, keyof Omit<FilaGastoMenorImportada, 'errores'>>();
  hoja.getRow(1).eachCell((celda, colNumero) => {
    const columna = COLUMNAS[normalizarEncabezado(celda.value)];
    if (columna) encabezados.set(colNumero, columna);
  });
  const columnasPresentes = new Set(encabezados.values());
  if (!columnasPresentes.has('cuentaBancaria') || !columnasPresentes.has('cuentaContable') || !columnasPresentes.has('valor')) {
    throw new Error('El archivo debe tener al menos las columnas "Cuenta bancaria", "Cuenta contable" y "Valor"');
  }

  const filas: FilaGastoMenorImportada[] = [];
  for (let i = 2; i <= hoja.rowCount; i++) {
    const fila = hoja.getRow(i);
    if (fila.cellCount === 0 || fila.actualCellCount === 0) continue;

    const datos: Partial<Record<keyof Omit<FilaGastoMenorImportada, 'errores'>, unknown>> = {};
    encabezados.forEach((columna, colNumero) => {
      datos[columna] = fila.getCell(colNumero).value;
    });

    const valor = celdaNumero(datos.valor);
    const porcentajeItbis = celdaNumero(datos.porcentajeItbis);
    const cantidad = celdaNumero(datos.cantidad);
    const filaGasto: FilaGastoMenorImportada = {
      fecha: celdaFecha(datos.fecha),
      cuentaBancaria: celdaTexto(datos.cuentaBancaria) ?? '',
      cuentaContable: celdaTexto(datos.cuentaContable) ?? '',
      concepto: celdaTexto(datos.concepto),
      valor,
      porcentajeItbis,
      cantidad,
      notas: celdaTexto(datos.notas),
      errores: [],
    };

    if (!filaGasto.cuentaBancaria) filaGasto.errores.push('Cuenta bancaria vacía');
    if (!filaGasto.cuentaContable) filaGasto.errores.push('Cuenta contable vacía');
    if (valor === undefined) filaGasto.errores.push('Valor vacío');
    else if (Number.isNaN(valor) || valor < 0) filaGasto.errores.push('Valor inválido (debe ser un número mayor o igual a 0)');
    if (porcentajeItbis !== undefined && (Number.isNaN(porcentajeItbis) || porcentajeItbis < 0 || porcentajeItbis > 100)) {
      filaGasto.errores.push('ITBIS % inválido (debe ser un número entre 0 y 100)');
    }
    if (cantidad !== undefined && (Number.isNaN(cantidad) || cantidad < 1)) {
      filaGasto.errores.push('Cantidad inválida (debe ser un número mayor o igual a 1)');
    }

    filas.push(filaGasto);
  }

  return filas;
}
