import { TipoDocumentoImpreso } from '@prisma/client';
import { DocumentoPdfParams } from './documento-pdf';
import { formatearMontoDop } from './formato-monto';

/**
 * "Formato de Documentos" Fase D/E — catálogo de campos individuales que se
 * pueden insertar como bloque suelto ("campo") en el editor de canvas
 * (Fase C). Antes de esto, los únicos bloques eran grupos fijos
 * (`encabezado` = número+fecha juntos, `datos_cliente` = nombre+RNC+
 * dirección+teléfono juntos) — esto permite anclar un solo dato en
 * cualquier posición, independiente de los demás.
 *
 * `tiposDocumento` acota en qué tipo(s) de documento tiene sentido
 * ofrecer cada campo — Fase F, a pedido del usuario ("en cada sección
 * solo deben aparecer los campos correspondientes"). Antes el catálogo
 * era una sola lista plana para los 4 tipos, mezclando campos exclusivos
 * de Factura (NCF, forma de pago) con los de Cotización/Remisión/Orden de
 * Compra — confuso, no un error de render (`valorCampoDocumento` ya
 * tolera un campo ausente), pero sí ruido real en el selector. El GET de
 * `campos-disponibles` filtra por esto cuando recibe `?tipo=`.
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
  | 'nota_pie'
  | 'proveedor_factura_numero'
  | 'proveedor_factura_monto'
  | 'fecha_recepcion';

const TODOS: TipoDocumentoImpreso[] = ['FACTURA', 'COTIZACION', 'REMISION', 'ORDEN_COMPRA'];

export const CAMPOS_DOCUMENTO: { clave: ClaveCampoDocumento; etiqueta: string; tiposDocumento: TipoDocumentoImpreso[] }[] = [
  { clave: 'numero', etiqueta: 'Número de documento (NCF si tiene, si no el interno)', tiposDocumento: TODOS },
  { clave: 'numero_interno', etiqueta: 'Número interno (sin NCF, aunque tenga)', tiposDocumento: ['FACTURA'] },
  { clave: 'ncf', etiqueta: 'NCF (comprobante fiscal)', tiposDocumento: ['FACTURA'] },
  { clave: 'tipo_ncf', etiqueta: 'Tipo de NCF', tiposDocumento: ['FACTURA'] },
  { clave: 'fecha', etiqueta: 'Fecha de emisión', tiposDocumento: TODOS },
  { clave: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', tiposDocumento: ['FACTURA', 'COTIZACION'] },
  { clave: 'tipoDocumento', etiqueta: 'Tipo de documento', tiposDocumento: TODOS },
  { clave: 'estado', etiqueta: 'Estado del documento', tiposDocumento: TODOS },
  { clave: 'plazo_pago_dias', etiqueta: 'Plazo de pago (días)', tiposDocumento: ['FACTURA'] },
  { clave: 'responsable_nombre', etiqueta: 'Vendedor / responsable', tiposDocumento: TODOS },
  { clave: 'forma_pago_nombre', etiqueta: 'Forma de pago', tiposDocumento: ['FACTURA'] },
  { clave: 'referencia_pago', etiqueta: 'Referencia de pago', tiposDocumento: ['FACTURA'] },
  { clave: 'motivo_nota', etiqueta: 'Motivo (Nota de Crédito/Débito)', tiposDocumento: ['FACTURA'] },
  { clave: 'motivo_anulacion', etiqueta: 'Motivo de anulación', tiposDocumento: ['FACTURA'] },
  { clave: 'motivo_rechazo', etiqueta: 'Motivo de rechazo', tiposDocumento: ['COTIZACION'] },
  { clave: 'bodega_nombre', etiqueta: 'Bodega', tiposDocumento: ['FACTURA', 'REMISION'] },
  { clave: 'tasa_cambio', etiqueta: 'Tasa de cambio', tiposDocumento: ['FACTURA'] },
  { clave: 'pagada', etiqueta: 'Pagada (Sí/No)', tiposDocumento: ['FACTURA', 'ORDEN_COMPRA'] },
  { clave: 'fecha_pago', etiqueta: 'Fecha de pago', tiposDocumento: ['FACTURA', 'ORDEN_COMPRA'] },
  { clave: 'cliente_nombre', etiqueta: 'Nombre del cliente / proveedor', tiposDocumento: TODOS },
  { clave: 'cliente_rnc', etiqueta: 'RNC/Cédula del cliente / proveedor', tiposDocumento: TODOS },
  { clave: 'cliente_direccion', etiqueta: 'Dirección del cliente', tiposDocumento: ['FACTURA', 'COTIZACION', 'REMISION'] },
  { clave: 'cliente_telefono', etiqueta: 'Teléfono del cliente / proveedor', tiposDocumento: TODOS },
  { clave: 'cliente_email', etiqueta: 'Email del cliente / proveedor', tiposDocumento: TODOS },
  { clave: 'cliente_nombre_contacto', etiqueta: 'Nombre de contacto', tiposDocumento: ['FACTURA', 'COTIZACION', 'REMISION'] },
  { clave: 'cliente_plazo_pago_dias', etiqueta: 'Plazo de pago del proveedor (días)', tiposDocumento: ['ORDEN_COMPRA'] },
  { clave: 'emisor_nombre', etiqueta: 'Nombre de la empresa', tiposDocumento: TODOS },
  { clave: 'emisor_rnc', etiqueta: 'RNC de la empresa', tiposDocumento: TODOS },
  { clave: 'emisor_direccion', etiqueta: 'Dirección de la empresa', tiposDocumento: TODOS },
  { clave: 'emisor_telefono', etiqueta: 'Teléfono de la empresa', tiposDocumento: TODOS },
  { clave: 'emisor_email', etiqueta: 'Email de la empresa', tiposDocumento: TODOS },
  { clave: 'subtotal', etiqueta: 'Subtotal', tiposDocumento: ['FACTURA', 'COTIZACION'] },
  { clave: 'descuento', etiqueta: 'Descuento', tiposDocumento: ['FACTURA', 'COTIZACION'] },
  { clave: 'itbis', etiqueta: 'ITBIS', tiposDocumento: ['FACTURA', 'COTIZACION'] },
  { clave: 'total', etiqueta: 'Total', tiposDocumento: ['FACTURA', 'COTIZACION', 'ORDEN_COMPRA'] },
  { clave: 'total_moneda', etiqueta: 'Total en moneda extranjera', tiposDocumento: ['FACTURA'] },
  { clave: 'observaciones', etiqueta: 'Observaciones', tiposDocumento: TODOS },
  { clave: 'nota_pie', etiqueta: 'Nota de pie / texto legal', tiposDocumento: TODOS },
  { clave: 'proveedor_factura_numero', etiqueta: 'Número de factura del proveedor', tiposDocumento: ['ORDEN_COMPRA'] },
  { clave: 'proveedor_factura_monto', etiqueta: 'Monto facturado por el proveedor', tiposDocumento: ['ORDEN_COMPRA'] },
  { clave: 'fecha_recepcion', etiqueta: 'Fecha de recepción de mercancía', tiposDocumento: ['ORDEN_COMPRA'] },
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
    case 'proveedor_factura_numero':
      return params.facturaProveedorNumero;
    case 'proveedor_factura_monto':
      return params.facturaProveedorMonto !== undefined ? formatearMontoDop(params.facturaProveedorMonto) : undefined;
    case 'fecha_recepcion':
      return params.fechaRecepcion?.toLocaleDateString('es-DO');
  }
}
