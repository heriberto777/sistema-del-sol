import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsuariosRepository } from './usuarios.repository';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearRolDto } from './dto/crear-rol.dto';
import { ActualizarRolDto } from './dto/actualizar-rol.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class UsuariosService {
  constructor(private readonly usuariosRepository: UsuariosRepository) {}

  async crear(dto: CrearUsuarioDto, tenantId: string) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.usuariosRepository.crear(dto.email, dto.nombre, passwordHash, dto.rolIds, tenantId);
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.usuariosRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.usuariosRepository.buscarPorId(id);
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto) {
    if (dto.nombre !== undefined || dto.activo !== undefined) {
      await this.usuariosRepository.actualizarDatos(id, { nombre: dto.nombre, activo: dto.activo });
    }
    if (dto.rolIds) {
      return this.usuariosRepository.reemplazarRoles(id, dto.rolIds);
    }
    return this.usuariosRepository.buscarPorId(id);
  }

  listarRoles() {
    return this.usuariosRepository.listarRoles();
  }

  listarPermisos() {
    return this.usuariosRepository.listarPermisos();
  }

  buscarRolPorId(id: string) {
    return this.usuariosRepository.buscarRolPorId(id);
  }

  crearRol(dto: CrearRolDto, tenantId: string) {
    return this.usuariosRepository.crearRol(tenantId, dto.nombre, dto.descripcion, dto.permisos);
  }

  actualizarRol(id: string, dto: ActualizarRolDto) {
    return this.usuariosRepository.actualizarRol(id, dto);
  }

  async eliminarRol(id: string) {
    const rol = await this.usuariosRepository.buscarRolPorId(id);
    if (rol.esSistema) {
      throw new BadRequestException('No se puede eliminar un rol del sistema');
    }
    const usuariosConRol = await this.usuariosRepository.contarUsuariosConRol(id);
    if (usuariosConRol > 0) {
      throw new BadRequestException('No se puede eliminar un rol que tiene usuarios asignados');
    }
    return this.usuariosRepository.eliminarRol(id);
  }
}
