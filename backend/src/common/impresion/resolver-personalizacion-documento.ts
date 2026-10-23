import { TipoDocumentoImpreso } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmisorDocumentoPdf, FirmaDocumentoPdf, QrDocumentoPdf } from '../pdf/documento-pdf';
import { LayoutDocumento } from '../pdf/documento-pdf-layout';
import { generarQrDataUri } from '../qr/generar-qr';

export const CLAVE_DOCUMENTO_NOTA_PIE = 'DOCUMENTO_NOTA_PIE';

/**
 * "Formato de Documentos" Fase C — valida la forma mínima de lo que haya
 * en `PersonalizacionDocumentoTipo.layoutPersonalizado` (JSON sin tipar a
 * nivel de base). Cualquier cosa que no sea `{ bloques: [...] }` se trata
 * como "no hay layout personalizado" (null) en vez de romper la
 * impresión — mismo criterio defensivo que `insertarLogo` ante un logo
 * corrupto: una fila mal guardada no puede tumbar la generación del PDF.
 */
function validarLayoutDocumento(valor: unknown): LayoutDocumento | null {
  if (!valor || typeof valor !== 'object') return null;
  const bloques = (valor as { bloques?: unknown }).bloques;
  if (!Array.isArray(bloques) || bloques.length === 0) return null;
  return { bloques: bloques as LayoutDocumento['bloques'] };
}

/**
 * Personalización de documentos imprimibles. Dos capas:
 *
 * 1. Logo/emisor/color de marca y nota de pie global — siempre se
 *    resuelven, vengan o no de un documento imprimible real (ver los
 *    ~8 call sites que NO pasan `tipoDocumento`: auth.service.ts para el
 *    logo del email de bienvenida, publicaciones-sociales, documentos-
 *    públicos, etc. — ninguno de esos necesita campos/columnas/QR/firma
 *    por tipo de documento, así que siguen funcionando idénticos).
 *
 * 2. "Formato de Documentos" Fase A/B1 (campos dinámicos, columnas,
 *    totales, texto legal propio, QR/firma genéricos) — solo se resuelve
 *    cuando `tipoDocumento` viene informado (Facturación/Cotizaciones/
 *    Remisiones, ver sus `generarImpreso()`). Sin fila de
 *    `PersonalizacionDocumentoTipo` para ese (tenant, tipo) — el caso de
 *    todo tenant que nunca abrió la pantalla nueva — todo vuelve
 *    `undefined`, que es exactamente "mostrar todo, sin QR ni firma": el
 *    comportamiento de siempre, sin backfill necesario.
 */
export async function resolverPersonalizacionDocumento(
  prisma: PrismaService,
  tenantId: string,
  tipoDocumento?: TipoDocumentoImpreso,
): Promise<{
  logo?: string;
  notaPie?: string;
  emisor?: EmisorDocumentoPdf;
  colorAcento?: string;
  camposEmisorVisibles?: ('rnc' | 'direccion' | 'telefono')[];
  camposClienteVisibles?: ('rnc' | 'direccion' | 'telefono')[];
  columnasLinea?: ('cantidad' | 'precioUnitario' | 'total')[];
  totalesVisibles?: ('subtotal' | 'descuento' | 'itbis' | 'total')[];
  qr?: QrDocumentoPdf;
  firma?: FirmaDocumentoPdf;
  layoutPersonalizado?: LayoutDocumento | null;
  observacionesVisibles: boolean;
}> {
  const [tenant, notaPieFila, configTipo] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logo: true, nombre: true, rnc: true, direccion: true, telefono: true, colorAcentoDocumentos: true },
    }),
    prisma.configuracion.findUnique({ where: { tenantId_clave: { tenantId, clave: CLAVE_DOCUMENTO_NOTA_PIE } } }),
    tipoDocumento ? prisma.personalizacionDocumentoTipo.findUnique({ where: { tenantId_tipoDocumento: { tenantId, tipoDocumento } } }) : null,
  ]);

  let qr: QrDocumentoPdf | undefined;
  if (configTipo?.qrHabilitado && configTipo.qrValor) {
    const dataUri = await generarQrDataUri(configTipo.qrValor);
    if (dataUri) qr = { dataUri, etiqueta: configTipo.qrContenido === 'LINK_PAGO' ? 'Escanea para pagar' : undefined };
  }

  const firma: FirmaDocumentoPdf | undefined = configTipo?.firmaHabilitada
    ? { etiqueta: configTipo.firmaEtiqueta || undefined, imagen: configTipo.firmaImagen || undefined }
    : undefined;

  return {
    logo: tenant?.logo || undefined,
    notaPie: configTipo?.textoLegal || notaPieFila?.valor || undefined,
    emisor: tenant ? { nombre: tenant.nombre, rnc: tenant.rnc || undefined, direccion: tenant.direccion || undefined, telefono: tenant.telefono || undefined } : undefined,
    colorAcento: tenant?.colorAcentoDocumentos || undefined,
    camposEmisorVisibles: configTipo ? (configTipo.camposEmisorVisibles as ('rnc' | 'direccion' | 'telefono')[]) : undefined,
    camposClienteVisibles: configTipo ? (configTipo.camposClienteVisibles as ('rnc' | 'direccion' | 'telefono')[]) : undefined,
    columnasLinea: configTipo ? (configTipo.columnasLinea as ('cantidad' | 'precioUnitario' | 'total')[]) : undefined,
    totalesVisibles: configTipo ? (configTipo.totalesVisibles as ('subtotal' | 'descuento' | 'itbis' | 'total')[]) : undefined,
    qr,
    firma,
    layoutPersonalizado: configTipo ? validarLayoutDocumento(configTipo.layoutPersonalizado) : null,
    // Sin fila de PersonalizacionDocumentoTipo, mismo criterio que el resto
    // de este objeto: "no hay configuración todavía" = comportamiento de
    // siempre, que acá es mostrar las observaciones si el documento las trae.
    observacionesVisibles: configTipo ? configTipo.observacionesVisibles : true,
  };
}
