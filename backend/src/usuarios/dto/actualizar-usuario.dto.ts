import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class ActualizarUsuarioDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ required: false, type: [String], description: 'Reemplaza los roles asignados' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  rolIds?: string[];

  @ApiProperty({ required: false, description: 'Fase 5 (Publicaciones Sociales) — para avisar por WhatsApp del negocio si tiene el permiso de aprobar' })
  @IsOptional()
  @IsString()
  telefono?: string;
}
