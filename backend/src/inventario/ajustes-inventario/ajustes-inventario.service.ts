import { BadRequestException, Injectable } from '@nestjs/common';
import { AjustesInventarioRepository } from './ajustes-inventario.repository';
import { CrearAjusteInventarioDto } from './dto/crear-ajuste-inventario.dto';
import { ActualizarAjusteInventarioDto } from './dto/actualizar-ajuste-inventario.dto';
import { CambiarEstadoAjusteInventarioDto } from './dto/cambiar-estado-ajuste-inventario.dto';
import { InventarioService, ETIQUETA_MOTIVO_AJUSTE } from '../inventario.service';
import { VariantesService } from '../../variantes/variantes.service';
import { AuthService } from '../../auth/auth.service';
import { CorrelativosRepository } from '../../correlativos/correlativos.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';
import { paginar } from '../../common/types/pagina-resultado';

/**
 * Ítem E-1 — activa Borrador→Confirmado para Ajustes de inventario: hasta
 * ahora `InventarioService.ajustarStock` era una escritura instantánea
 * sobre el ledger `MovimientoInventario`, sin cabecera. Este módulo agrega
 * el documento (AjusteInventario + líneas) — `confirmar()` es el único
 * momento en que se toca stock de verdad, reusando
 * `InventarioService.ajustarCantidadEnTx` (=`InventarioRepository.
 * ajustarCantidadEnTx`) tal cual, una vez por línea. `crear()`/
 * `actualizar()` nunca mueven stock.
 */
@Injectable()
export class AjustesInventarioService {
  constructor(
    private readonly ajustesInventarioRepository: AjustesInventarioRepository,
    private readonly inventarioService: InventarioService,
    private readonly variantesService: VariantesService,
    private readonly authService: AuthService,
    private readonly correlativosRepository: CorrelativosRepository,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async crear(dto: CrearAjusteInventarioDto, tenantId: string, userId: string) {
    await this.inventarioService.validarAccesoBodega(dto.bodegaId, userId);
    const lineas = await this.resolverLineas(dto.lineas);

    return this.tenantPrisma.client.$transaction(async (tx) => {
      const numero = await this.correlativosRepository.siguienteEnTx(tx, tenantId, 'AJUSTE');
      return this.ajustesInventarioRepository.crearEnTx(tx, { tenantId, numero, bodegaId: dto.bodegaId, userId, lineas });
    });
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.ajustesInventarioRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.ajustesInventarioRepository.buscarPorId(id);
  }

  /** Ítem E-1 — solo se puede editar un ajuste en BORRADOR, mismo guard que CotizacionesService.actualizar/ComprasService.actualizar. */
  async actualizar(id: string, dto: ActualizarAjusteInventarioDto) {
    const ajuste = await this.ajustesInventarioRepository.buscarPorId(id);
    if (ajuste.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se puede editar un ajuste de inventario en borrador');
    }
    const lineas = await this.resolverLineas(dto.lineas);
    return this.ajustesInventarioRepository.actualizar(id, { lineas });
  }

  /**
   * CONFIRMADO: dispara el movimiento real de stock (una vez por línea,
   * todo en una transacción) y marca el ajuste como CONFIRMADO. CANCELADO:
   * transición directa, nunca se aplicó stock. Ambos solo desde BORRADOR.
   */
  async cambiarEstado(id: string, dto: CambiarEstadoAjusteInventarioDto, tenantId: string, userId: string) {
    const ajuste = await this.ajustesInventarioRepository.buscarPorId(id);
    if (ajuste.estado !== 'BORRADOR') {
      throw new BadRequestException(`Solo se puede ${dto.estado === 'CONFIRMADO' ? 'confirmar' : 'cancelar'} un ajuste en borrador`);
    }

    if (dto.estado === 'CANCELADO') {
      return this.tenantPrisma.client.$transaction((tx) => this.ajustesInventarioRepository.actualizarEstado(tx, id, 'CANCELADO'));
    }

    // Fase 9: PIN de confirmación solo si alguna línea es una salida (mismo criterio que InventarioService.ajustarStock).
    if (ajuste.lineas.some((l) => Number(l.cantidad) < 0)) {
      await this.authService.verificarPin(userId, dto.pin);
    }

    return this.tenantPrisma.client.$transaction(async (tx) => {
      for (const linea of ajuste.lineas) {
        const cantidad = Number(linea.cantidad);
        await this.inventarioService.ajustarCantidadEnTx(tx, {
          tenantId,
          productoId: linea.productoId,
          varianteId: linea.varianteId,
          bodegaId: ajuste.bodegaId,
          delta: cantidad,
          tipo: 'AJUSTE',
          userId,
          motivo: linea.motivo?.trim() || ETIQUETA_MOTIVO_AJUSTE[linea.motivoAjuste!],
          motivoAjuste: linea.motivoAjuste ?? undefined,
          referenciaTipo: 'AJUSTE_INVENTARIO',
          referenciaId: ajuste.id,
          controlaVencimiento: linea.producto.controlaVencimiento,
          lotesEntrada:
            cantidad >= 0 && linea.numeroLote && linea.fechaVencimiento
              ? [{ numeroLote: linea.numeroLote, fechaVencimiento: linea.fechaVencimiento, cantidad }]
              : undefined,
          loteIdSalida: cantidad < 0 ? (linea.loteId ?? undefined) : undefined,
        });
      }
      return this.ajustesInventarioRepository.actualizarEstado(tx, id, 'CONFIRMADO');
    });
  }

  private resolverLineas(lineas: CrearAjusteInventarioDto['lineas']) {
    return Promise.all(
      lineas.map(async (linea) => ({
        ...linea,
        varianteId: await this.variantesService.resolverObligatoria(linea.productoId, linea.varianteId),
      })),
    );
  }
}
