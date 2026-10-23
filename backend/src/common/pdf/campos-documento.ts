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
  | 'numero_interno'
  | 'ncf'
  | 'tipo_ncf'
  | 'fecha'
  | 'fecha_vencimiento'
  | 'tipoDocumento'
  | 'estado'
  | 'plazo_pago_dias'
  | 'responsable_nombre'
  | 'forma_pago_nombre'
  | 'referencia_pago'
  | 'motivo_nota'
  | 'motivo_anulacion'
  | 'motivo_rechazo'
  | 'bodega_nombre'
  | 'tasa_cambio'
  | 'pagada'
  | 'fecha_pago'
  | 'cliente_nombre'
  | 'cliente_rnc'
  | 'cliente_direccion'
  | 'cliente_telefono'
  | 'cliente_email'
  | 'cliente_nombre_contacto'
  | 'cliente_plazo_pago_dias'
  | 'emisor_nombre'
  | 'emisor_rnc'
  | 'emisor_direccion'
  | 'emisor_telefono'
  | 'emisor_email'
  | 'subtotal'
  | 'descuento'
  | 'itbis'
  | 'total'
  | 'total_moneda'
  | 'observaciones'
  | 'nota_pie';

export const CAMPOS_DOCUMENTO: { clave: ClaveCampoDocumento; etiqueta: string }[] = [
  { clave: 'numero', etiqueta: 'Número de documento (NCF si tiene, si no el interno)' },
  { clave: 'numero_interno', etiqueta: 'Número interno (sin NCF, aunque tenga)' },
  { clave: 'ncf', etiqueta: 'NCF (comprobante fiscal)' },
  { clave: 'tipo_ncf', etiqueta: 'Tipo de NCF' },
  { clave: 'fecha', etiqueta: 'Fecha de emisión' },
  { clave: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento' },
  { clave: 'tipoDocumento', etiqueta: 'Tipo de documento' },
  { clave: 'estado', etiqueta: 'Estado del documento' },
  { clave: 'plazo_pago_dias', etiqueta: 'Plazo de pago (días)' },
  { clave: 'responsable_nombre', etiqueta: 'Vendedor / responsable' },
  { clave: 'forma_pago_nombre', etiqueta: 'Forma de pago' },
  { clave: 'referencia_pago', etiqueta: 'Referencia de pago' },
  { clave: 'motivo_nota', etiqueta: 'Motivo (Nota de Crédito/Débito)' },
  { clave: 'motivo_anulacion', etiqueta: 'Motivo de anulación' },
  { clave: 'motivo_rechazo', etiqueta: 'Motivo de rechazo' },
  { clave: 'bodega_nombre', etiqueta: 'Bodega' },
  { clave: 'tasa_cambio', etiqueta: 'Tasa de cambio' },
  { clave: 'pagada', etiqueta: 'Pagada (Sí/No)' },
  { clave: 'fecha_pago', etiqueta: 'Fecha de pago' },
  { clave: 'cliente_nombre', etiqueta: 'Nombre del cliente / proveedor' },
  { clave: 'cliente_rnc', etiqueta: 'RNC/Cédula del cliente / proveedor' },
  { clave: 'cliente_direccion', etiqueta: 'Dirección del cliente' },
  { clave: 'cliente_telefono', etiqueta: 'Teléfono del cliente / proveedor' },
  { clave: 'cliente_email', etiqueta: 'Email del cliente / proveedor' },
  { clave: 'cliente_nombre_contacto', etiqueta: 'Nombre de contacto' },
  { clave: 'cliente_plazo_pago_dias', etiqueta: 'Plazo de pago del proveedor (días)' },
  { clave: 'emisor_nombre', etiqueta: 'Nombre de la empresa' },
  { clave: 'emisor_rnc', etiqueta: 'RNC de la empresa' },
  { clave: 'emisor_direccion', etiqueta: 'Dirección de la empresa' },
  { clave: 'emisor_telefono', etiqueta: 'Teléfono de la empresa' },
  { clave: 'emisor_email', etiqueta: 'Email de la empresa' },
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
    case 'numero_interno':
      return params.numeroInterno;
    case 'ncf':
      return params.ncf;
    case 'tipo_ncf':
      return params.tipoNcf;
    case 'fecha':
      return params.fecha.toLocaleDateString('es-DO');
    case 'fecha_vencimiento':
      return params.fechaVencimiento?.toLocaleDateString('es-DO');
    case 'tipoDocumento':
      return params.tipoDocumento;
    case 'estado':
      return params.estado;
    case 'plazo_pago_dias':
      return params.plazoPagoDias !== undefined ? `${params.plazoPagoDias} días` : undefined;
    case 'responsable_nombre':
      return params.responsableNombre;
    case 'forma_pago_nombre':
      return params.formaPagoNombre;
    case 'referencia_pago':
      return params.referenciaPago;
    case 'motivo_nota':
      return params.motivoNota;
    case 'motivo_anulacion':
      return params.motivoAnulacion;
    case 'motivo_rechazo':
      return params.motivoRechazo;
    case 'bodega_nombre':
      return params.bodegaNombre;
    case 'tasa_cambio':
      return params.tasaCambio !== undefined ? params.tasaCambio.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : undefined;
    case 'pagada':
      return params.pagada !== undefined ? (params.pagada ? 'Sí' : 'No') : undefined;
    case 'fecha_pago':
      return params.fechaPago?.toLocaleDateString('es-DO');
    case 'cliente_nombre':
      return params.cliente;
    case 'cliente_rnc':
      return params.clienteDatosExtra?.rnc;
    case 'cliente_direccion':
      return params.clienteDatosExtra?.direccion;
    case 'cliente_telefono':
      return params.clienteDatosExtra?.telefono;
    case 'cliente_email':
      return params.clienteDatosExtra?.email;
    case 'cliente_nombre_contacto':
      return params.clienteDatosExtra?.nombreContacto;
    case 'cliente_plazo_pago_dias':
      return params.clienteDatosExtra?.plazoPagoDias !== undefined ? `${params.clienteDatosExtra.plazoPagoDias} días` : undefined;
    case 'emisor_nombre':
      return params.emisor?.nombre;
    case 'emisor_rnc':
      return params.emisor?.rnc;
    case 'emisor_direccion':
      return params.emisor?.direccion;
    case 'emisor_telefono':
      return params.emisor?.telefono;
    case 'emisor_email':
      return params.emisor?.email;
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
