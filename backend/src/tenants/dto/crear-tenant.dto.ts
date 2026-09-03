import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotIn, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { SUBDOMINIOS_RESERVADOS } from '../subdominios-reservados';

export class CrearTenantDto {
  @ApiProperty({ description: 'Id del Plan a asignar — ver GET /platform/planes' })
  @IsUUID()
  planId: string;

  @ApiProperty({ example: 'Distribuidora Ejemplo SRL' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'distribuidora-ejemplo', description: 'Subdominio único, solo minúsculas/números/guiones' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'El subdominio solo puede tener minúsculas, números y guiones' })
  @IsNotIn(SUBDOMINIOS_RESERVADOS, { message: 'Ese subdominio está reservado para infraestructura del sistema — elegí otro' })
  subdominio: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rnc?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ required: false, description: 'Correo de la empresa (distinto del correo del admin inicial)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'admin@distribuidora-ejemplo.com' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'Administrador' })
  @IsString()
  adminNombre: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  adminPassword: string;
}
