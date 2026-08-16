import ExcelJS from 'exceljs';

export interface ColumnaReporte {
  header: string;
  key: string;
  width?: number;
}

/** Genera un .xlsx real (no CSV) con una hoja de datos y un encabezado en negrita. */
export async function generarExcel(
  titulo: string,
  columnas: ColumnaReporte[],
  filas: Record<string, unknown>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'El Sistema del Sol';
  workbook.created = new Date();

  const hoja = workbook.addWorksheet(titulo.slice(0, 31));
  hoja.columns = columnas.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  hoja.getRow(1).font = { bold: true };
  hoja.addRows(filas);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
