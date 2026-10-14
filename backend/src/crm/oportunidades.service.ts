import { BadRequestException, Injectable } from '@nestjs/common';
import { OportunidadesRepository } from './oportunidades.repository';
import { EtapasPipelineService } from './etapas-pipeline.service';
import { LeadsService } from './leads.service';
import { ClientesService } from '../clientes/clientes.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import { CrearOportunidadDto } from './dto/crear-oportunidad.dto';
import { CambiarEtapaOportunidadDto } from './dto/cambiar-etapa-oportunidad.dto';
import { CerrarOportunidadDto } from './dto/cerrar-oportunidad.dto';
import { ConvertirOportunidadDto } from './dto/convertir-oportunidad.dto';
import { ListarOportunidadesQueryDto } from './dto/listar-oportunidades-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class OportunidadesService {
  constructor(
    private readonly oportunidadesRepository: OportunidadesRepository,
    private readonly etapasPipelineService: EtapasPipelineService,
    private readonly leadsService: LeadsService,
    private readonly clientesService: ClientesService,
    private readonly cotizacionesService: CotizacionesService,
  ) {}

  /**
   * clienteId/leadId mutuamente excluyentes — el DTO (@ValidateIf) solo
   * valida el formato del que corresponda, no rechaza "ambos" ni "ninguno"
   * (mismo límite que LineaFacturaDto.productoId/descripcionManual), así
   * que ese chequeo real vive acá. Cada id referenciado (cliente/lead/
   * etapa/vendedor) se resuelve contra ESTE tenant antes de usarlo — 404
   * si no existe o es de otro tenant (prevención de IDOR, CLAUDE.md).
   */
  private async validarReferencias(dto: { clienteId?: string; leadId?: string; etapaId?: string; vendedorId?: string }) {
    if (!dto.clienteId === !dto.leadId) {
      throw new BadRequestException('Una oportunidad debe tener exactamente un cliente o un lead, no ambos ni ninguno.');
    }
    if (dto.clienteId) await this.clientesService.buscarPorId(dto.clienteId);
    if (dto.leadId) await this.leadsService.buscarPorId(dto.leadId);
    if (dto.etapaId) await this.etapasPipelineService.buscarPorId(dto.etapaId);
    if (dto.vendedorId) await this.oportunidadesRepository.validarVendedorDelTenant(dto.vendedorId);
  }

  async crear(dto: CrearOportunidadDto, tenantId: string, usuarioActualId: string) {
    await this.validarReferencias(dto);
    const etapa = await this.etapasPipelineService.buscarPorId(dto.etapaId);
    return this.oportunidadesRepository.crear({
      ...dto,
      tenantId,
      vendedorId: dto.vendedorId ?? usuarioActualId,
      probabilidadPct: dto.probabilidadPct ?? etapa.probabilidadDefault,
      fechaCierreEstimada: new Date(dto.fechaCierreEstimada),
    });
  }

  async listar(query: ListarOportunidadesQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const { datos, total } = await this.oportunidadesRepository.listar({
      skip,
      take,
      busqueda: query.busqueda,
      estado: query.estado,
      vendedorId: query.vendedorId,
      clienteId: query.clienteId,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  async obtenerPipeline() {
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    const [abiertas, ganadasRecientes, perdidasRecientes] = await Promise.all([
      this.oportunidadesRepository.listarPipeline(),
      this.oportunidadesRepository.listarCerradasRecientes('GANADA', desde),
      this.oportunidadesRepository.listarCerradasRecientes('PERDIDA', desde),
    ]);
    return { abiertas, ganadasRecientes, perdidasRecientes };
  }

  buscarPorId(id: string) {
    return this.oportunidadesRepository.buscarPorId(id);
  }

  private validarQueSigaAbierta(oportunidad: { estado: string }) {
    if (oportunidad.estado !== 'ABIERTA') {
      throw new BadRequestException('Esta oportunidad ya está cerrada (ganada o perdida) — no se puede modificar.');
    }
  }

  async actualizar(id: string, dto: Partial<CrearOportunidadDto>) {
    const oportunidad = await this.oportunidadesRepository.buscarPorId(id);
    this.validarQueSigaAbierta(oportunidad);
    await this.validarReferencias({
      clienteId: dto.clienteId ?? oportunidad.clienteId ?? undefined,
      leadId: dto.leadId ?? oportunidad.leadId ?? undefined,
      etapaId: dto.etapaId,
      vendedorId: dto.vendedorId,
    });
    return this.oportunidadesRepository.actualizar(id, {
      ...dto,
      fechaCierreEstimada: dto.fechaCierreEstimada ? new Date(dto.fechaCierreEstimada) : undefined,
    });
  }

  async cambiarEtapa(id: string, dto: CambiarEtapaOportunidadDto) {
    const oportunidad = await this.oportunidadesRepository.buscarPorId(id);
    this.validarQueSigaAbierta(oportunidad);
    await this.etapasPipelineService.buscarPorId(dto.etapaId);
    return this.oportunidadesRepository.cambiarEtapa(id, dto.etapaId);
  }

  async cerrar(id: string, dto: CerrarOportunidadDto) {
    const oportunidad = await this.oportunidadesRepository.buscarPorId(id);
    this.validarQueSigaAbierta(oportunidad);
    if (dto.estado === 'PERDIDA' && !dto.motivoPerdida) {
      throw new BadRequestException('Indicá un motivo para marcar la oportunidad como perdida.');
    }
    return this.oportunidadesRepository.cerrar(id, dto.estado, dto.motivoPerdida);
  }

  /**
   * CRM "Cotización conectada" — genera la Cotización real de la
   * Oportunidad. Si está sobre un Lead (sin Cliente todavía), primero lo
   * convierte (LeadsService.convertir — dispara CLIENTE_CREADO como
   * cualquier alta normal de cliente) y recién ahí genera la cotización
   * contra ese Cliente nuevo.
   *
   * `dto.lineas` son líneas reales del catálogo (mismo DTO que crear una
   * cotización normal) — si se omiten, cae al comportamiento anterior de
   * una única línea manual con el título/monto estimado, por
   * compatibilidad. Generar la cotización NO gana la oportunidad sola —
   * sigue ABIERTA hasta que el cliente la aprueba desde el link público y
   * el vendedor la convierte en factura (ver OportunidadesEventosService).
   */
  async convertirEnCotizacion(id: string, dto: ConvertirOportunidadDto, tenantId: string, vendedorId: string) {
    const oportunidad = await this.oportunidadesRepository.buscarPorId(id);
    this.validarQueSigaAbierta(oportunidad);

    let clienteId = oportunidad.clienteId;
    if (!clienteId) {
      const cliente = await this.leadsService.convertir(
        oportunidad.leadId as string,
        { tipo: dto.tipoClienteNuevo, rncCedula: dto.rncCedulaClienteNuevo },
        tenantId,
      );
      clienteId = cliente.id;
    }

    const cotizacion = await this.cotizacionesService.crear(
      {
        clienteId,
        fechaVigenciaHasta: dto.fechaVigenciaHastaCotizacion,
        lineas: dto.lineas ?? [{ descripcionManual: oportunidad.titulo, cantidad: 1, precioUnitario: Number(oportunidad.montoEstimado) }],
      },
      tenantId,
      vendedorId,
    );

    return this.oportunidadesRepository.vincularCotizacion(id, cotizacion.id, oportunidad.clienteId ? undefined : clienteId);
  }

  /** `cotizacionId` todavía no se usa en Fase 1 (se llena recién en la Fase 2, al ganar) — el chequeo queda listo para entonces. */
  async eliminar(id: string) {
    const oportunidad = await this.oportunidadesRepository.buscarPorId(id);
    if (oportunidad.cotizacionId) {
      throw new BadRequestException('Esta oportunidad ya generó una cotización — no se puede eliminar.');
    }
    await this.oportunidadesRepository.eliminar(id);
  }
}
