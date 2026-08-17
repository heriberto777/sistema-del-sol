import { ApiProperty } from '@nestjs/swagger';
import { EstadoTenant } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
