import { ApiProperty } from '@nestjs/swagger';
import { EstadoReporteTenant } from '@prisma/client';
import { IsEnum } from 'class-validator';

/** Cambiar el estado de un ticket — acción separada de enviar un mensaje (solo plataforma). */
export class CambiarEstadoReporteTenantDto {
  @ApiProperty({ enum: EstadoReporteTenant })
  @IsEnum(EstadoReporteTenant)
  estado: EstadoReporteTenant;
}
