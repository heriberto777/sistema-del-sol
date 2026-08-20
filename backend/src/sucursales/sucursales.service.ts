import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SucursalesRepository } from './sucursales.repository';
import { CrearSucursalDto } from './dto/crear-sucursal.dto';
import { ActualizarSucursalDto } from './dto/actualizar-sucursal.dto';

@Injectable()
export class SucursalesService {
  constructor(private readonly sucursalesRepository: SucursalesRepository) {}

  async crear(dto: CrearSucursalDto, tenantId: string) {
    try {
      return await this.sucursalesRepository.crear(tenantId, dto);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya existe otra sucursal con ese nombre');
      }
      throw error;
    }
  }

  listar() {
    return this.sucursalesRepository.listar();
  }

  buscarPorId(id: string) {
    return this.sucursalesRepository.buscarPorId(id);
  }

  async actualizar(id: string, dto: ActualizarSucursalDto) {
    try {
      return await this.sucursalesRepository.actualizar(id, dto);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya existe otra sucursal con ese nombre');
      }
      throw error;
    }
  }
}
