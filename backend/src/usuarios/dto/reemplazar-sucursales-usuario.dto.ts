import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

/** Reemplaza el set completo de sucursales asignadas — un array vacío deja al usuario sin ninguna (ve/puede elegir TODAS, ver ARCHITECTURE.md). */
export class ReemplazarSucursalesUsuarioDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  sucursalIds: string[];
}
