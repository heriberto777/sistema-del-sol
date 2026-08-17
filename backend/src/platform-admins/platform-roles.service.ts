import { Injectable } from '@nestjs/common';
import { PlatformRolesRepository } from './platform-roles.repository';
import { CrearPlatformRoleDto } from './dto/crear-platform-role.dto';
import { ActualizarPlatformRoleDto } from './dto/actualizar-platform-role.dto';

@Injectable()
export class PlatformRolesService {
  constructor(private readonly platformRolesRepository: PlatformRolesRepository) {}

  listar() {
    return this.platformRolesRepository.listar();
  }

  buscarPorId(id: string) {
    return this.platformRolesRepository.buscarPorId(id);
  }

  listarPermisos() {
    return this.platformRolesRepository.listarPermisos();
  }

  crear(dto: CrearPlatformRoleDto) {
    return this.platformRolesRepository.crear(dto);
  }

  actualizar(id: string, dto: ActualizarPlatformRoleDto) {
    return this.platformRolesRepository.actualizar(id, dto);
  }
}
