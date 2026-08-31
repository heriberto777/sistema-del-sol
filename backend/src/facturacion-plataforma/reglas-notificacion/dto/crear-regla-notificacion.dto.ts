import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { CanalNotificacionVencimiento } from '@prisma/client';

export class CrearReglaNotificacionDto {
  @ApiProperty({ description: 'Negativo = antes del vencimiento, positivo = después (mora). 0 = el mismo día.' })
  @IsInt()
  offsetDias: number;

  @ApiProperty({ enum: CanalNotificacionVencimiento })
  @IsEnum(CanalNotificacionVencimiento)
  canal: CanalNotificacionVencimiento;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
