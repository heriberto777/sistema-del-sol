import { BadRequestException, Injectable } from '@nestjs/common';
import { RemisionesRepository } from './remisiones.repository';
import { FacturacionService } from '../facturacion/facturacion.service';
import { CrearRemisionDto } from './dto/crear-remision.dto';
import { ConvertirRemisionDto } from './dto/convertir-remision.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { generarDocumentoPdf } from '../common/pdf/documento-pdf';

@Injectable()
export class RemisionesService {
  constructor(
    private readonly remisionesRepository: RemisionesRepository,
    private readonly facturacionService: FacturacionService,
  ) {}

  crear(dto: CrearRemisionDto, tenantId: string, vendedorId: string) {
    return this.remisionesRepository.crear({
      tenantId,
      clienteId: dto.clienteId,
      bodegaId: dto.bodegaId,
      vendedorId,
      numero: dto.numero,
      lineas: dto.lineas,
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
      numero: dto.numero,
      lineas: dto.lineas,
    });
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.remisionesRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  async cambiarEstado(id: string, estado: 'ENTREGADA' | 'ANULADA') {
    const remision = await this.remisionesRepository.buscarPorId(id);
    this.validarQueSigaAbierta(remision);
    return this.remisionesRepository.actualizarEstado(id, estado);
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
          cantidad: Number(linea.cantidad),
        })),
      },
      tenantId,
      vendedorId,
    );

    await this.remisionesRepository.marcarFacturada(id, factura.id);
    return factura;
  }

  async generarPdf(id: string) {
    const remision = await this.remisionesRepository.buscarPorId(id);
    return generarDocumentoPdf({
      tipoDocumento: 'Remisión',
      numero: remision.numero,
      fecha: remision.fecha,
      cliente: remision.cliente.nombre,
      mostrarPrecios: false,
      lineas: remision.lineas.map((linea) => ({
        concepto: linea.producto.nombre,
        cantidad: linea.cantidad.toString(),
      })),
    });
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
