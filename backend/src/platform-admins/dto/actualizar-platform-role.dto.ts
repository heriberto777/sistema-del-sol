import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ActualizarPlatformRoleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiProperty({ required: false, type: [String], description: 'Si se envía, reemplaza el set completo de permisos' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permisos?: string[];
}
