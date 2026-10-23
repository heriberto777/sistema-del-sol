import { DocumentoPdfParams } from './documento-pdf';
import { formatearMontoDop } from './formato-monto';

/**
 * "Formato de Documentos" Fase D — catálogo de campos individuales que se
 * pueden insertar como bloque suelto ("campo") en el editor de canvas
 * (Fase C). Antes de esto, los únicos bloques eran grupos fijos
 * (`encabezado` = número+fecha juntos, `datos_cliente` = nombre+RNC+
 * dirección+teléfono juntos) — esto permite anclar un solo dato en
 * cualquier posición, independiente de los demás.
 *
 * Un documento que no tenga un campo (ej. Remisión sin `subtotal`, Orden
 * de Compra sin desglose de ITBIS) simplemente no dibuja nada para ese
 * bloque — mismo criterio tolerante que ya usa el bloque `totales` con
 * `FilaTotal` ausente, no es un error.
 */
export type ClaveCampoDocumento =
  | 'numero'
  | 'fecha'
  | 'tipoDocumento'
  | 'cliente_nombre'
  | 'cliente_rnc'
  | 'cliente_direccion'
  | 'cliente_telefono'
  | 'emisor_nombre'
  | 'emisor_rnc'
  | 'emisor_direccion'
  | 'emisor_telefono'
  | 'subtotal'
  | 'descuento'
  | 'itbis'
  | 'total'
  | 'total_moneda'
  | 'observaciones'
  | 'nota_pie';

export const CAMPOS_DOCUMENTO: { clave: ClaveCampoDocumento; etiqueta: string }[] = [
  { clave: 'numero', etiqueta: 'Número de documento' },
  { clave: 'fecha', etiqueta: 'Fecha' },
  { clave: 'tipoDocumento', etiqueta: 'Tipo de documento' },
  { clave: 'cliente_nombre', etiqueta: 'Nombre del cliente' },
  { clave: 'cliente_rnc', etiqueta: 'RNC/Cédula del cliente' },
  { clave: 'cliente_direccion', etiqueta: 'Dirección del cliente' },
  { clave: 'cliente_telefono', etiqueta: 'Teléfono del cliente' },
  { clave: 'emisor_nombre', etiqueta: 'Nombre de la empresa' },
  { clave: 'emisor_rnc', etiqueta: 'RNC de la empresa' },
  { clave: 'emisor_direccion', etiqueta: 'Dirección de la empresa' },
  { clave: 'emisor_telefono', etiqueta: 'Teléfono de la empresa' },
  { clave: 'subtotal', etiqueta: 'Subtotal' },
  { clave: 'descuento', etiqueta: 'Descuento' },
  { clave: 'itbis', etiqueta: 'ITBIS' },
  { clave: 'total', etiqueta: 'Total' },
  { clave: 'total_moneda', etiqueta: 'Total en moneda extranjera' },
  { clave: 'observaciones', etiqueta: 'Observaciones' },
  { clave: 'nota_pie', etiqueta: 'Nota de pie / texto legal' },
];

export function valorCampoDocumento(params: DocumentoPdfParams, clave: ClaveCampoDocumento): string | undefined {
  switch (clave) {
    case 'numero':
      return params.numero;
    case 'fecha':
      return params.fecha.toLocaleDateString('es-DO');
    case 'tipoDocumento':
      return params.tipoDocumento;
    case 'cliente_nombre':
      return params.cliente;
    case 'cliente_rnc':
      return params.clienteDatosExtra?.rnc;
    case 'cliente_direccion':
      return params.clienteDatosExtra?.direccion;
    case 'cliente_telefono':
      return params.clienteDatosExtra?.telefono;
    case 'emisor_nombre':
      return params.emisor?.nombre;
    case 'emisor_rnc':
      return params.emisor?.rnc;
    case 'emisor_direccion':
      return params.emisor?.direccion;
    case 'emisor_telefono':
      return params.emisor?.telefono;
    case 'subtotal':
      return params.subtotal !== undefined ? formatearMontoDop(params.subtotal) : undefined;
    case 'descuento':
      return params.descuento !== undefined ? formatearMontoDop(params.descuento) : undefined;
    case 'itbis':
      return params.itbis !== undefined ? formatearMontoDop(params.itbis) : undefined;
    case 'total':
      return params.total !== undefined ? formatearMontoDop(params.total) : undefined;
    case 'total_moneda':
      return params.totalEnMoneda ? `${params.totalEnMoneda.moneda} ${formatearMontoDop(params.totalEnMoneda.monto)}` : undefined;
    case 'observaciones':
      return params.notas;
    case 'nota_pie':
      return params.notaPie;
  }
}
