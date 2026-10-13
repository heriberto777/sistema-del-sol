import { BadRequestException, Injectable } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { ClientesService } from '../clientes/clientes.service';
import { CrearLeadDto } from './dto/crear-lead.dto';
import { CambiarEstadoLeadDto } from './dto/cambiar-estado-lead.dto';
import { ConvertirLeadDto } from './dto/convertir-lead.dto';
import { ListarLeadsQueryDto } from './dto/listar-leads-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly clientesService: ClientesService,
  ) {}

  async crear(dto: CrearLeadDto, tenantId: string, usuarioActualId: string) {
    const vendedorId = dto.vendedorId ?? usuarioActualId;
    if (dto.vendedorId) await this.leadsRepository.validarVendedorDelTenant(dto.vendedorId);
    return this.leadsRepository.crear({ ...dto, tenantId, vendedorId });
  }

  async listar(query: ListarLeadsQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const { datos, total } = await this.leadsRepository.listar({
      skip,
      take,
      busqueda: query.busqueda,
      estado: query.estado,
      vendedorId: query.vendedorId,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.leadsRepository.buscarPorId(id);
  }

  async actualizar(id: string, dto: Partial<CrearLeadDto>) {
    const lead = await this.leadsRepository.buscarPorId(id);
    if (lead.estado === 'CONVERTIDO') {
      throw new BadRequestException('Este lead ya fue convertido en cliente — no se puede editar.');
    }
    if (dto.vendedorId) await this.leadsRepository.validarVendedorDelTenant(dto.vendedorId);
    return this.leadsRepository.actualizar(id, dto);
  }

  /**
   * CONVERTIDO queda fuera del DTO (reservado para la Fase 2) — acá solo
   * se valida que el lead no esté ya convertido. Revivir uno DESCARTADO
   * (volverlo a NUEVO/CONTACTADO) está permitido a propósito, mismo
   * criterio decidido para Cotizaciones rechazadas: el cliente puede
   * cambiar de opinión sin perder el historial del lead.
   */
  async cambiarEstado(id: string, dto: CambiarEstadoLeadDto) {
    const lead = await this.leadsRepository.buscarPorId(id);
    if (lead.estado === 'CONVERTIDO') {
      throw new BadRequestException('Este lead ya fue convertido en cliente.');
    }
    if (dto.estado === 'DESCARTADO' && !dto.motivoDescarte) {
      throw new BadRequestException('Indicá un motivo para descartar el lead.');
    }
    return this.leadsRepository.cambiarEstado(id, dto.estado, dto.estado === 'DESCARTADO' ? dto.motivoDescarte : null);
  }

  /**
   * Fase 2 — reusa ClientesService.crear() tal cual (dispara
   * EVENTOS.CLIENTE_CREADO, valida listaPrecioId/categoriaId, etc.), el
   * CRM no duplica esa lógica. nombre/email/telefono se heredan del Lead;
   * `dto.tipo`/`rncCedula` son lo único que el Lead no tenía y el Cliente
   * sí necesita. También la usa internamente
   * OportunidadesService.convertirEnCotizacion() cuando la oportunidad
   * ganada está sobre un Lead en vez de un Cliente ya existente.
   */
  async convertir(id: string, dto: ConvertirLeadDto, tenantId: string) {
    const lead = await this.leadsRepository.buscarPorId(id);
    if (lead.estado === 'CONVERTIDO') {
      throw new BadRequestException('Este lead ya fue convertido en cliente.');
    }
    const cliente = await this.clientesService.crear(
      { nombre: lead.nombre, email: lead.email ?? undefined, telefono: lead.telefono ?? undefined, tipo: dto.tipo ?? 'PERSONA_FISICA', rncCedula: dto.rncCedula },
      tenantId,
    );
    await this.leadsRepository.marcarConvertido(id, cliente.id);
    return cliente;
  }
}
