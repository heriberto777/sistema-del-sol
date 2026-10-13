import { BadRequestException, Injectable } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { CrearLeadDto } from './dto/crear-lead.dto';
import { CambiarEstadoLeadDto } from './dto/cambiar-estado-lead.dto';
import { ListarLeadsQueryDto } from './dto/listar-leads-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class LeadsService {
  constructor(private readonly leadsRepository: LeadsRepository) {}

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
}
