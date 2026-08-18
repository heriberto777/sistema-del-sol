import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PlatformAdminsRepository } from './platform-admins.repository';
import { CrearPlatformAdminDto } from './dto/crear-platform-admin.dto';
import { ActualizarPlatformAdminDto } from './dto/actualizar-platform-admin.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class PlatformAdminsService {
  constructor(private readonly platformAdminsRepository: PlatformAdminsRepository) {}

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.platformAdminsRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  async crear(dto: CrearPlatformAdminDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.platformAdminsRepository.crear({
      email: dto.email,
      passwordHash,
      nombre: dto.nombre,
      roleId: dto.roleId,
    });
  }

  actualizar(id: string, dto: ActualizarPlatformAdminDto, adminAutenticadoId: string) {
    if (id === adminAutenticadoId && dto.activo === false) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta de plataforma');
    }
    return this.platformAdminsRepository.actualizar(id, dto);
  }
}
