import { ApiProperty } from '@nestjs/swagger';
import { EstadoTenant } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

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
