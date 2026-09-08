import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CrearUsuarioDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ type: [String], description: 'IDs de roles a asignar' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  rolIds: string[];

  @ApiProperty({ required: false, description: 'Fase 5 (Publicaciones Sociales) — para avisar por WhatsApp del negocio si tiene el permiso de aprobar' })
  @IsOptional()
  @IsString()
  telefono?: string;
}
