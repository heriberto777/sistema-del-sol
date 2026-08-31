import { BadRequestException, Injectable } from '@nestjs/common';
import { TransferenciasInventarioRepository } from './transferencias-inventario.repository';
import { CrearTransferenciaInventarioDto } from './dto/crear-transferencia-inventario.dto';
import { ActualizarTransferenciaInventarioDto } from './dto/actualizar-transferencia-inventario.dto';
import { CambiarEstadoTransferenciaInventarioDto } from './dto/cambiar-estado-transferencia-inventario.dto';
import { InventarioService } from '../inventario.service';
import { VariantesService } from '../../variantes/variantes.service';
import { CorrelativosRepository } from '../../correlativos/correlativos.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';
import { paginar } from '../../common/types/pagina-resultado';

/**
 * Ítem E-1 — activa Borrador→Confirmado para Transferencias de inventario:
 * mismo criterio que AjustesInventarioService, pero `confirmar()` reusa
 * `InventarioService.transferirStockEnTx` (=`InventarioRepository.
 * transferirEnTx`) — ya resuelve FEFO/lotes internamente, sin necesitar
 * nada extra por línea (a diferencia de Ajustes). `crear()`/`actualizar()`
 * nunca mueven stock.
 */
@Injectable()
export class TransferenciasInventarioService {
  constructor(
    private readonly transferenciasInventarioRepository: TransferenciasInventarioRepository,
    private readonly inventarioService: InventarioService,
    private readonly variantesService: VariantesService,
    private readonly correlativosRepository: CorrelativosRepository,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async crear(dto: CrearTransferenciaInventarioDto, tenantId: string, userId: string) {
    // Fase 9 — igual que InventarioService.transferirStock: acceso a AMBAS bodegas, no solo la de origen.
    await Promise.all([
      this.inventarioService.validarAccesoBodega(dto.bodegaOrigenId, userId),
      this.inventarioService.validarAccesoBodega(dto.bodegaDestinoId, userId),
    ]);
    const lineas = await this.resolverLineas(dto.lineas);

    return this.tenantPrisma.client.$transaction(async (tx) => {
      const numero = await this.correlativosRepository.siguienteEnTx(tx, tenantId, 'TRANSFERENCIA');
      return this.transferenciasInventarioRepository.crearEnTx(tx, {
        tenantId,
        numero,
        bodegaOrigenId: dto.bodegaOrigenId,
        bodegaDestinoId: dto.bodegaDestinoId,
        userId,
        lineas,
      });
    });
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.transferenciasInventarioRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.transferenciasInventarioRepository.buscarPorId(id);
  }

  /** Ítem E-1 — solo se puede editar una transferencia en BORRADOR. */
  async actualizar(id: string, dto: ActualizarTransferenciaInventarioDto) {
    const transferencia = await this.transferenciasInventarioRepository.buscarPorId(id);
    if (transferencia.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se puede editar una transferencia en borrador');
    }
    const lineas = await this.resolverLineas(dto.lineas);
    return this.transferenciasInventarioRepository.actualizar(id, { lineas });
  }

  /**
   * CONFIRMADO: dispara el movimiento real de stock (una vez por línea,
   * todo en una transacción) y marca la transferencia como CONFIRMADO.
   * CANCELADO: transición directa, nunca se aplicó stock. Ambos solo desde BORRADOR.
   */
  async cambiarEstado(id: string, dto: CambiarEstadoTransferenciaInventarioDto, tenantId: string, userId: string) {
    const transferencia = await this.transferenciasInventarioRepository.buscarPorId(id);
    if (transferencia.estado !== 'BORRADOR') {
      throw new BadRequestException(`Solo se puede ${dto.estado === 'CONFIRMADO' ? 'confirmar' : 'cancelar'} una transferencia en borrador`);
    }

    if (dto.estado === 'CANCELADO') {
      return this.tenantPrisma.client.$transaction((tx) => this.transferenciasInventarioRepository.actualizarEstado(tx, id, 'CANCELADO'));
    }

    return this.tenantPrisma.client.$transaction(async (tx) => {
      for (const linea of transferencia.lineas) {
        await this.inventarioService.transferirStockEnTx(tx, {
          tenantId,
          productoId: linea.productoId,
          varianteId: linea.varianteId,
          bodegaOrigenId: transferencia.bodegaOrigenId,
          bodegaDestinoId: transferencia.bodegaDestinoId,
          cantidad: Number(linea.cantidad),
          userId,
        });
      }
      return this.transferenciasInventarioRepository.actualizarEstado(tx, id, 'CONFIRMADO');
    });
  }

  private resolverLineas(lineas: CrearTransferenciaInventarioDto['lineas']) {
    return Promise.all(
      lineas.map(async (linea) => ({
        ...linea,
        varianteId: await this.variantesService.resolverObligatoria(linea.productoId, linea.varianteId),
      })),
    );
  }
}
