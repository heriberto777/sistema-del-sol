import { Injectable } from '@nestjs/common';
import { FormatoImpresion, TipoDocumentoImpreso } from '@prisma/client';
import { PersonalizacionDocumentosRepository } from './personalizacion-documentos.repository';
import { ActualizarPersonalizacionTipoDto } from './dto/actualizar-personalizacion-tipo.dto';
import { ActualizarMarcaDocumentosDto } from './dto/actualizar-marca-documentos.dto';
import { PrismaService } from '../prisma/prisma.service';
import { resolverPlantillaDocumento } from '../common/impresion/resolver-plantilla-documento';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';
import { generarDocumentoPdfLayout } from '../common/pdf/documento-pdf-layout';
import { generarDocumentoTicketHtml } from '../common/pdf/documento-ticket';

const TIPOS: TipoDocumentoImpreso[] = ['FACTURA', 'COTIZACION', 'REMISION', 'ORDEN_COMPRA'];

const ETIQUETA_TIPO: Record<TipoDocumentoImpreso, string> = {
  FACTURA: 'Factura de venta',
  COTIZACION: 'Cotización',
  REMISION: 'Remisión',
  ORDEN_COMPRA: 'Orden de compra',
};

/** Datos de muestra para la vista previa — nunca los de un documento real del tenant. */
function lineasDeMuestra() {
  return [
    {
      concepto: 'Producto o servicio de ejemplo',
      cantidad: '2',
      precioUnitario: '850.00',
      total: '1,700.00',
      codigo: 'PROD-001',
      categoria: 'Categoría de ejemplo',
      unidadMedida: 'Unidad',
      porcentajeItbis: '18%',
      descuentoLinea: 'RD$ 0.00',
    },
    {
      concepto: 'Otro producto de ejemplo',
      cantidad: '1',
      precioUnitario: '450.00',
      total: '450.00',
      codigo: 'PROD-002',
      categoria: 'Otra categoría',
      unidadMedida: 'Caja',
      porcentajeItbis: '18%',
      descuentoLinea: 'RD$ 0.00',
    },
  ];
}

@Injectable()
export class PersonalizacionDocumentosService {
  constructor(
    private readonly repository: PersonalizacionDocumentosRepository,
    private readonly prisma: PrismaService,
  ) {}

  async listar(tenantId: string) {
    const [marca, filas] = await Promise.all([this.repository.obtenerMarca(tenantId), this.repository.listarTipos(tenantId)]);
    const porTipo = new Map(filas.map((f) => [f.tipoDocumento, f]));
    return {
      colorAcentoDocumentos: marca.colorAcentoDocumentos,
      logo: marca.logo,
      tipos: TIPOS.map((tipoDocumento) => {
        const fila = porTipo.get(tipoDocumento);
        return {
          tipoDocumento,
          etiqueta: ETIQUETA_TIPO[tipoDocumento],
          camposEmisorVisibles: fila?.camposEmisorVisibles ?? [],
          camposClienteVisibles: fila?.camposClienteVisibles ?? [],
          columnasLinea: fila?.columnasLinea ?? [],
          totalesVisibles: fila?.totalesVisibles ?? [],
          textoLegal: fila?.textoLegal ?? '',
          qrHabilitado: fila?.qrHabilitado ?? false,
          qrContenido: fila?.qrContenido ?? null,
          qrValor: fila?.qrValor ?? '',
          firmaHabilitada: fila?.firmaHabilitada ?? false,
          firmaEtiqueta: fila?.firmaEtiqueta ?? '',
          firmaImagen: fila?.firmaImagen ?? '',
          observacionesVisibles: fila?.observacionesVisibles ?? true,
          layoutPersonalizado: (fila?.layoutPersonalizado as { bloques?: unknown[] } | null)?.bloques ?? null,
          layoutTermico: (fila?.layoutTermico as { bloques?: unknown[] } | null)?.bloques ?? null,
        };
      }),
    };
  }

  actualizarMarca(tenantId: string, dto: ActualizarMarcaDocumentosDto) {
    return this.repository.actualizarMarca(tenantId, dto.colorAcentoDocumentos || null);
  }

  actualizarTipo(tenantId: string, tipoDocumento: TipoDocumentoImpreso, dto: ActualizarPersonalizacionTipoDto) {
    return this.repository.upsertTipo(tenantId, tipoDocumento, dto);
  }

  actualizarLayout(tenantId: string, tipoDocumento: TipoDocumentoImpreso, bloques: Record<string, unknown>[] | null | undefined) {
    return this.repository.actualizarLayout(tenantId, tipoDocumento, bloques ?? null);
  }

  actualizarLayoutTermico(tenantId: string, tipoDocumento: TipoDocumentoImpreso, bloques: Record<string, unknown>[] | null | undefined) {
    return this.repository.actualizarLayoutTermico(tenantId, tipoDocumento, bloques ?? null);
  }

  /**
   * Vista previa — genera un documento con datos de ejemplo y la
   * configuración YA GUARDADA para ese tipo (no la del formulario sin
   * guardar: guardar primero, previsualizar después, mismo criterio
   * simple que el resto del sistema). Con `formato` térmico, devuelve el
   * HTML del ticket (con su propio `layoutTermico`) en vez de un PDF.
   */
  async generarPreview(tenantId: string, tipoDocumento: TipoDocumentoImpreso, formato?: FormatoImpresion): Promise<{ buffer: Buffer; contentType: string }> {
    const [plantilla, personalizacion] = await Promise.all([
      resolverPlantillaDocumento(this.prisma, tenantId, null),
      resolverPersonalizacionDocumento(this.prisma, tenantId, tipoDocumento),
    ]);

    const { layoutPersonalizado, layoutTermico, ...resto } = personalizacion;
    const params = {
      tipoDocumento: ETIQUETA_TIPO[tipoDocumento],
      numero: 'B0200000001',
      fecha: new Date(),
      cliente: 'Cliente de ejemplo, SRL',
      clienteDatosExtra: {
        rnc: '130-00000-1',
        direccion: 'Calle Ejemplo #1, Santo Domingo',
        telefono: '809-000-0000',
        email: 'cliente@ejemplo.com',
        nombreContacto: 'Juan Pérez',
        plazoPagoDias: 30,
      },
      lineas: lineasDeMuestra(),
      mostrarPrecios: tipoDocumento !== 'REMISION',
      subtotal: 2150,
      descuento: 0,
      itbis: 387,
      total: 2537,
      estado: 'EMITIDA',
      plazoPagoDias: 30,
      fechaVencimiento: new Date(Date.now() + 30 * 86400000),
      responsableNombre: 'Vendedor de ejemplo',
      formaPagoNombre: 'Transferencia',
      referenciaPago: 'REF-000123',
      bodegaNombre: 'Bodega principal',
      ncf: 'B0100000001',
      numeroInterno: 'FAC-000001',
      tipoNcf: 'B01',
      pagada: false,
      fechaPago: undefined,
      facturaProveedorNumero: 'FACT-PROV-00045',
      facturaProveedorMonto: 2537,
      fechaRecepcion: new Date(),
      ...resto,
    };

    if (formato === 'TERMICA_80MM' || formato === 'TERMICA_58MM') {
      return { buffer: Buffer.from(generarDocumentoTicketHtml(params, formato, layoutTermico), 'utf-8'), contentType: 'text/html; charset=utf-8' };
    }
    const buffer = layoutPersonalizado ? await generarDocumentoPdfLayout(params, layoutPersonalizado) : await generarDocumentoPdf(params, { plantilla });
    return { buffer, contentType: 'application/pdf' };
  }
}
