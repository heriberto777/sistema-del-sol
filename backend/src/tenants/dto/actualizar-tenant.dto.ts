import { ApiProperty } from '@nestjs/swagger';
import { EstadoTenant } from '@prisma/client';
import { IsEmail, IsEnum, IsNotIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { SUBDOMINIOS_RESERVADOS } from '../subdominios-reservados';

export class ActualizarTenantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiProperty({ required: false, enum: EstadoTenant })
  @IsOptional()
  @IsEnum(EstadoTenant)
  estado?: EstadoTenant;

  @ApiProperty({ required: false, description: 'Id del Plan a asignar — ver /platform/planes' })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rnc?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'El subdominio solo puede tener minúsculas, números y guiones' })
  @IsNotIn(SUBDOMINIOS_RESERVADOS, { message: 'Ese subdominio está reservado para infraestructura del sistema — elegí otro' })
  subdominio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;
}
