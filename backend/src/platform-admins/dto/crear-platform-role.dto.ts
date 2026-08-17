import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class CrearPlatformRoleDto {
  @ApiProperty({ example: 'Ventas' })
  @IsString()
  nombre: string;

  @ApiProperty({ type: [String], description: 'Claves de permisos de plataforma (ver PERMISOS_PLATAFORMA_BASE)' })
  @IsArray()
  @IsString({ each: true })
  permisos: string[];
}
