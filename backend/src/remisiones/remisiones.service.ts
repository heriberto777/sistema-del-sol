import { BadRequestException, Injectable } from '@nestjs/common';
import { RemisionesRepository } from './remisiones.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { VariantesService } from '../variantes/variantes.service';
import { InventarioService } from '../inventario/inventario.service';
import { expandirParaInventario } from '../inventario/expandir-para-inventario';
import { CorrelativosRepository } from '../correlativos/correlativos.repository';
import { CrearRemisionDto } from './dto/crear-remision.dto';
import { ConvertirRemisionDto } from './dto/convertir-remision.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { DocumentoPdfParams, generarDocumentoPdf } from '../common/pdf/documento-pdf';
import { generarDocumentoTicketHtml } from '../common/pdf/documento-ticket';
import { resolverFormatoImpresion } from '../common/impresion/resolver-formato-impresion';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FormatoImpresion } from '@prisma/client';

@Injectable()
export class RemisionesService {
  constructor(
    private readonly remisionesRepository: RemisionesRepository,
    private readonly facturacionService: FacturacionService,
    private readonly variantesService: VariantesService,
    private readonly inventarioService: InventarioService,
    private readonly correlativosRepository: CorrelativosRepository,
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  private async resolverLineas(lineas: CrearRemisionDto['lineas']) {
    return Promise.all(
      lineas.map(async (linea) => ({
        productoId: linea.productoId,
        varianteId: await this.variantesService.resolverObligatoria(linea.productoId, linea.varianteId),
        cantidad: linea.cantidad,
      })),
    );
  }

  async crear(dto: CrearRemisionDto, tenantId: string, vendedorId: string) {
    const lineas = await this.resolverLineas(dto.lineas);
    return this.tenantPrisma.client.$transaction(async (tx) => {
      const numero = await this.correlativosRepository.siguienteEnTx(tx, tenantId, 'REMISION');
      return this.remisionesRepository.crearEnTx(tx, {
        tenantId,
        clienteId: dto.clienteId,
        bodegaId: dto.bodegaId,
        vendedorId,
        numero,
        lineas,
      });
    });
  }

  buscarPorId(id: string) {
    return this.remisionesRepository.buscarPorId(id);
  }

  async actualizar(id: string, dto: CrearRemisionDto) {
    const remision = await this.remisionesRepository.buscarPorId(id);
    if (remision.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se puede editar una remisión en borrador');
    }
    return this.remisionesRepository.actualizar(id, {
      clienteId: dto.clienteId,
      bodegaId: dto.bodegaId,
      lineas: await this.resolverLineas(dto.lineas),
    });
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.remisionesRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  /**
   * "Remisión + stock" — a diferencia de la v1 (ver el comentario del
   * modelo en schema.prisma), BORRADOR → ENTREGADA ahora descuenta
   * inventario de verdad: una remisión entregada representa mercancía que
   * YA salió físicamente, no solo al convertirla en factura.
   * BORRADOR → ANULADA nunca movió stock, nada que reintegrar.
   * ENTREGADA → ANULADA sí lo reintegra (ya se había descontado al
   * entregar). `convertirEnFactura` sabe, por el estado ENTREGADA, que no
   * debe descontar una segunda vez (ver `sinMovimientoInventario` ahí).
   */
  async cambiarEstado(id: string, estado: 'ENTREGADA' | 'ANULADA', tenantId: string, userId: string) {
    const remision = await this.remisionesRepository.buscarPorId(id);
    this.validarQueSigaAbierta(remision);
    if (estado === 'ENTREGADA' && remision.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se puede marcar entregada una remisión en borrador');
    }

    return this.tenantPrisma.client.$transaction(async (tx) => {
      if (estado === 'ENTREGADA') {
        for (const linea of remision.lineas) {
          const producto = { tipoProducto: linea.producto.tipo, componentesCombo: linea.producto.componentes };
          for (const item of expandirParaInventario(producto, linea.productoId, Number(linea.cantidad), linea.varianteId)) {
            await this.inventarioService.verificarYDescontarStockEnTx(tx, {
              tenantId,
              productoId: item.productoId,
              varianteId: item.varianteId,
              bodegaId: remision.bodegaId,
              cantidad: item.cantidad,
              userId,
              referencia: `Remisión ${remision.numero}`,
              referenciaTipo: 'REMISION',
              referenciaId: remision.id,
            });
          }
        }
      } else if (remision.estado === 'ENTREGADA') {
        for (const linea of remision.lineas) {
          const producto = { tipoProducto: linea.producto.tipo, componentesCombo: linea.producto.componentes };
          for (const item of expandirParaInventario(producto, linea.productoId, Number(linea.cantidad), linea.varianteId)) {
            await this.inventarioService.entradaStockEnTx(tx, {
              tenantId,
              productoId: item.productoId,
              varianteId: item.varianteId,
              bodegaId: remision.bodegaId,
              cantidad: item.cantidad,
              userId,
              motivo: `Anulación de remisión ${remision.numero}`,
            });
          }
        }
      }

      return this.remisionesRepository.actualizarEstadoEnTx(tx, id, estado);
    });
  }

  async convertirEnFactura(id: string, dto: ConvertirRemisionDto, tenantId: string, vendedorId: string) {
    const remision = await this.remisionesRepository.buscarPorId(id);
    this.validarQueSigaAbierta(remision);

    const factura = await this.facturacionService.crear(
      {
        clienteId: remision.clienteId,
        bodegaId: remision.bodegaId,
        tipoFactura: dto.tipoFactura,
        lineas: remision.lineas.map((linea) => ({
          productoId: linea.productoId,
          varianteId: linea.varianteId,
          cantidad: Number(linea.cantidad),
        })),
      },
      tenantId,
      vendedorId,
      // Si la remisión ya pasó por ENTREGADA, el stock YA se descontó ahí
      // (ver cambiarEstado) — crear() no debe volver a hacerlo. Si se
      // convierte directo desde BORRADOR (nunca entregada), crear() mueve
      // stock como siempre — cero cambio de comportamiento para ese camino.
      { sinMovimientoInventario: remision.estado === 'ENTREGADA' },
    );

    await this.remisionesRepository.marcarFacturada(id, factura.id);
    return factura;
  }

  private mapearRemisionAParams(remision: Awaited<ReturnType<RemisionesRepository['buscarPorId']>>): DocumentoPdfParams {
    return {
      tipoDocumento: 'Remisión',
      numero: remision.numero,
      fecha: remision.fecha,
      cliente: remision.cliente.nombre,
      mostrarPrecios: false,
      lineas: remision.lineas.map((linea) => ({
        concepto: linea.producto.nombre,
        cantidad: linea.cantidad.toString(),
      })),
    };
  }

  /** @deprecated usar generarImpreso — se mantiene por compatibilidad de la ruta /pdf ya existente. */
  async generarPdf(id: string) {
    const remision = await this.remisionesRepository.buscarPorId(id);
    return generarDocumentoPdf(this.mapearRemisionAParams(remision));
  }

  async generarImpreso(id: string, formatoSolicitado: FormatoImpresion | undefined, tenantId: string) {
    const remision = await this.remisionesRepository.buscarPorId(id);
    const [formato, personalizacion] = await Promise.all([
      formatoSolicitado ?? resolverFormatoImpresion(this.prisma, tenantId, remision.bodegaId),
      resolverPersonalizacionDocumento(this.prisma, tenantId),
    ]);
    const params = { ...this.mapearRemisionAParams(remision), ...personalizacion };

    if (formato === 'TERMICA_80MM' || formato === 'TERMICA_58MM') {
      return { buffer: Buffer.from(generarDocumentoTicketHtml(params, formato), 'utf-8'), contentType: 'text/html; charset=utf-8' };
    }
    const buffer = await generarDocumentoPdf(params, { tamanoPagina: formato === 'A4' ? 'a4' : 'letter' });
    return { buffer, contentType: 'application/pdf' };
  }

  private validarQueSigaAbierta(remision: { estado: string; facturaId: string | null }) {
    if (remision.facturaId) {
      throw new BadRequestException('Esta remisión ya fue convertida en factura');
    }
    if (remision.estado === 'ANULADA') {
      throw new BadRequestException('No se puede operar sobre una remisión anulada');
    }
  }
}
