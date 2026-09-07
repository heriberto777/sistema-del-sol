import { BadRequestException, Injectable } from '@nestjs/common';
import { ConteoFisicoRepository } from './conteo-fisico.repository';
import { CrearConteoFisicoDto } from './dto/crear-conteo-fisico.dto';
import { ListarConteoFisicoQueryDto } from './dto/listar-conteo-fisico-query.dto';
import { InventarioService } from '../inventario.service';
import { AjustesInventarioService } from '../ajustes-inventario/ajustes-inventario.service';
import { CorrelativosRepository } from '../../correlativos/correlativos.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { paginar } from '../../common/types/pagina-resultado';

/**
 * Conteo Físico vs Teórico — proceso DISTINTO de un Ajuste directo: acá el
 * usuario no sabe el delta de antemano, cuenta a ciegas (la pantalla de
 * captura nunca muestra `cantidadTeorica`, eso es responsabilidad del
 * frontend) y recién en la revisión se calcula la diferencia. Al aplicar,
 * NUNCA mueve stock por sí mismo — genera y confirma un `AjusteInventario`
 * real (motivo `CORRECCION_CONTEO`) solo con las líneas que tuvieron
 * diferencia, reusando `AjustesInventarioService.crear()`/`cambiarEstado()`
 * tal cual (mismo criterio que "Cotizaciones se convierte en Factura
 * reusando `FacturacionService.crear()`").
 */
@Injectable()
export class ConteoFisicoService {
  constructor(
    private readonly conteoFisicoRepository: ConteoFisicoRepository,
    private readonly inventarioService: InventarioService,
    private readonly ajustesInventarioService: AjustesInventarioService,
    private readonly correlativosRepository: CorrelativosRepository,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async crear(dto: CrearConteoFisicoDto, tenantId: string, userId: string) {
    await this.inventarioService.validarAccesoBodega(dto.bodegaId, userId);

    // Decisión de diseño confirmada: un solo conteo ABIERTO por bodega a
    // la vez — evita dos snapshots del teórico compitiendo sobre la misma
    // bodega.
    const abierto = await this.conteoFisicoRepository.buscarAbiertoPorBodega(dto.bodegaId);
    if (abierto) {
      throw new BadRequestException(`Ya hay un conteo físico abierto (${abierto.numero}) para esta bodega — aplicalo o cancelalo antes de iniciar uno nuevo.`);
    }

    let variantes;
    if (dto.alcance === 'TOTAL') {
      variantes = await this.conteoFisicoRepository.todoElStockDeLaBodega(dto.bodegaId);
    } else {
      if (!dto.varianteIds?.length) {
        throw new BadRequestException('Elegí al menos un producto para un conteo por selección.');
      }
      variantes = await this.conteoFisicoRepository.stockDeVariantesEnBodega(dto.varianteIds, dto.bodegaId);
    }
    if (variantes.length === 0) {
      throw new BadRequestException('No hay productos para contar en esta bodega (los que controlan vencimiento por lote quedan fuera de esta primera versión).');
    }

    return this.tenantPrisma.client.$transaction(async (tx) => {
      const numero = await this.correlativosRepository.siguienteEnTx(tx, tenantId, 'CONTEO_FISICO');
      return this.conteoFisicoRepository.crearEnTx(tx, {
        tenantId,
        numero,
        bodegaId: dto.bodegaId,
        alcance: dto.alcance,
        notas: dto.notas,
        userId,
        variantes,
      });
    });
  }

  listar(query: ListarConteoFisicoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    return this.conteoFisicoRepository
      .listar({ skip, take, busqueda: query.busqueda, bodegaId: query.bodegaId, estado: query.estado })
      .then(([datos, total]) => ({ datos, total, pagina, tamanoPagina }));
  }

  buscarPorId(id: string) {
    return this.conteoFisicoRepository.buscarPorId(id);
  }

  /**
   * `lineaId` nunca se confía directo del cliente: se valida que
   * pertenezca a ESTE `conteoId` (ya resuelto tenant-scoped por
   * `buscarPorId`) antes de tocarla — `LineaConteoFisico` es una tabla
   * hija sin `tenantId` propio (mismo patrón/riesgo IDOR que
   * `LineaAjusteInventario`, ver ARCHITECTURE.md).
   */
  async capturarLinea(conteoId: string, lineaId: string, cantidadContada: number, userId: string) {
    const conteo = await this.conteoFisicoRepository.buscarPorId(conteoId);
    if (conteo.estado !== 'ABIERTO') {
      throw new BadRequestException('Este conteo ya no está abierto — no se puede seguir capturando.');
    }
    if (!conteo.lineas.some((l) => l.id === lineaId)) {
      throw new BadRequestException('Esta línea no pertenece a este conteo.');
    }
    // `userId` es quien captura ESTA línea puntual — puede no ser el mismo
    // que abrió el conteo si cuenta más de una persona (trazabilidad por
    // línea, ver LineaConteoFisico.contadoPorId).
    return this.conteoFisicoRepository.actualizarLinea(lineaId, cantidadContada, userId);
  }

  async aplicar(id: string, tenantId: string, userId: string, pin?: string) {
    const conteo = await this.conteoFisicoRepository.buscarPorId(id);
    if (conteo.estado !== 'ABIERTO') {
      throw new BadRequestException('Este conteo ya fue aplicado o cancelado.');
    }

    const lineasConDiferencia = conteo.lineas.filter(
      (l) => l.cantidadContada !== null && Number(l.cantidadContada) !== Number(l.cantidadTeorica),
    );

    let ajusteId: string | undefined;
    if (lineasConDiferencia.length > 0) {
      const ajuste = await this.ajustesInventarioService.crear(
        {
          bodegaId: conteo.bodegaId,
          lineas: lineasConDiferencia.map((l) => ({
            productoId: l.productoId,
            varianteId: l.varianteId,
            cantidad: Number(l.cantidadContada) - Number(l.cantidadTeorica),
            motivoAjuste: 'CORRECCION_CONTEO' as const,
          })),
        },
        tenantId,
        userId,
      );
      try {
        await this.ajustesInventarioService.cambiarEstado(ajuste.id, { estado: 'CONFIRMADO', pin }, tenantId, userId);
      } catch (error) {
        // Si el PIN es incorrecto (u otro rechazo de cambiarEstado), el
        // Ajuste ya quedó creado en BORRADOR — cancelarlo (transición
        // segura, sin PIN ni movimiento de stock) para no dejarlo huérfano
        // sin ningún ConteoFisico que lo referencie (bug real encontrado
        // en la verificación en vivo: un PIN incorrecto dejaba un Ajuste
        // BORRADOR fantasma para siempre).
        await this.ajustesInventarioService.cambiarEstado(ajuste.id, { estado: 'CANCELADO' }, tenantId, userId);
        throw error;
      }
      ajusteId = ajuste.id;
    }

    return this.conteoFisicoRepository.marcarAplicado(id, ajusteId);
  }

  async cancelar(id: string) {
    const conteo = await this.conteoFisicoRepository.buscarPorId(id);
    if (conteo.estado !== 'ABIERTO') {
      throw new BadRequestException('Solo se puede cancelar un conteo abierto.');
    }
    return this.conteoFisicoRepository.cancelar(id);
  }
}
