import { Injectable } from '@nestjs/common';
import { TipoDocumentoImpreso } from '@prisma/client';
import { PersonalizacionDocumentosRepository } from './personalizacion-documentos.repository';
import { ActualizarPersonalizacionTipoDto } from './dto/actualizar-personalizacion-tipo.dto';
import { ActualizarMarcaDocumentosDto } from './dto/actualizar-marca-documentos.dto';
import { PrismaService } from '../prisma/prisma.service';
import { resolverPlantillaDocumento } from '../common/impresion/resolver-plantilla-documento';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';
import { generarDocumentoPdfLayout } from '../common/pdf/documento-pdf-layout';

const TIPOS: TipoDocumentoImpreso[] = ['FACTURA', 'COTIZACION', 'REMISION'];

const ETIQUETA_TIPO: Record<TipoDocumentoImpreso, string> = {
  FACTURA: 'Factura de venta',
  COTIZACION: 'Cotización',
  REMISION: 'Remisión',
};

/** Datos de muestra para la vista previa — nunca los de un documento real del tenant. */
function lineasDeMuestra() {
  return [
    { concepto: 'Producto o servicio de ejemplo', cantidad: '2', precioUnitario: '850.00', total: '1,700.00' },
    { concepto: 'Otro producto de ejemplo', cantidad: '1', precioUnitario: '450.00', total: '450.00' },
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

  /** Vista previa — genera un PDF con datos de ejemplo y la configuración YA GUARDADA para ese tipo (no la del formulario sin guardar: guardar primero, previsualizar después, mismo criterio simple que el resto del sistema). */
  async generarPreview(tenantId: string, tipoDocumento: TipoDocumentoImpreso): Promise<Buffer> {
    const [plantilla, personalizacion] = await Promise.all([
      resolverPlantillaDocumento(this.prisma, tenantId, null),
      resolverPersonalizacionDocumento(this.prisma, tenantId, tipoDocumento),
    ]);

    const { layoutPersonalizado, ...resto } = personalizacion;
    const params = {
      tipoDocumento: ETIQUETA_TIPO[tipoDocumento],
      numero: 'B0200000001',
      fecha: new Date(),
      cliente: 'Cliente de ejemplo, SRL',
      clienteDatosExtra: { rnc: '130-00000-1', direccion: 'Calle Ejemplo #1, Santo Domingo', telefono: '809-000-0000' },
      lineas: lineasDeMuestra(),
      mostrarPrecios: tipoDocumento !== 'REMISION',
      subtotal: 2150,
      descuento: 0,
      itbis: 387,
      total: 2537,
      ...resto,
    };

    return layoutPersonalizado ? generarDocumentoPdfLayout(params, layoutPersonalizado) : generarDocumentoPdf(params, { plantilla });
  }
}
