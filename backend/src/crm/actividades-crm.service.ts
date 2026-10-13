import { BadRequestException, Injectable } from '@nestjs/common';
import { ActividadesCrmRepository } from './actividades-crm.repository';
import { ClientesService } from '../clientes/clientes.service';
import { LeadsService } from './leads.service';
import { OportunidadesService } from './oportunidades.service';
import { CrearActividadCrmDto } from './dto/crear-actividad-crm.dto';
import { ListarActividadesCrmQueryDto } from './dto/listar-actividades-crm-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class ActividadesCrmService {
  constructor(
    private readonly actividadesCrmRepository: ActividadesCrmRepository,
    private readonly clientesService: ClientesService,
    private readonly leadsService: LeadsService,
    private readonly oportunidadesService: OportunidadesService,
  ) {}

  /**
   * Exactamente uno de clienteId/leadId/oportunidadId — el DTO
   * (@ValidateIf) solo valida formato, el "exactamente uno" real vive
   * acá, mismo límite ya documentado en OportunidadesService.
   */
  private async validarReferencia(dto: { clienteId?: string; leadId?: string; oportunidadId?: string }) {
    const referencias = [dto.clienteId, dto.leadId, dto.oportunidadId].filter(Boolean);
    if (referencias.length !== 1) {
      throw new BadRequestException('Una actividad debe estar ligada a exactamente un cliente, lead u oportunidad.');
    }
    if (dto.clienteId) await this.clientesService.buscarPorId(dto.clienteId);
    if (dto.leadId) await this.leadsService.buscarPorId(dto.leadId);
    if (dto.oportunidadId) await this.oportunidadesService.buscarPorId(dto.oportunidadId);
  }

  async crear(dto: CrearActividadCrmDto, tenantId: string, usuarioId: string) {
    await this.validarReferencia(dto);
    return this.actividadesCrmRepository.crear({ ...dto, tenantId, usuarioId });
  }

  async listar(query: ListarActividadesCrmQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const { datos, total } = await this.actividadesCrmRepository.listar({
      skip,
      take,
      clienteId: query.clienteId,
      leadId: query.leadId,
      oportunidadId: query.oportunidadId,
      completada: query.completada === undefined ? undefined : query.completada === 'true',
    });
    return { datos, total, pagina, tamanoPagina };
  }

  async marcarCompletada(id: string, completada: boolean) {
    await this.actividadesCrmRepository.buscarPorId(id);
    return this.actividadesCrmRepository.marcarCompletada(id, completada);
  }

  async eliminar(id: string) {
    await this.actividadesCrmRepository.buscarPorId(id);
    await this.actividadesCrmRepository.eliminar(id);
  }
}
