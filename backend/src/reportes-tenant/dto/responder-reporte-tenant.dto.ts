import { ApiProperty } from '@nestjs/swagger';
import { EstadoReporteTenant } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class ResponderReporteTenantDto {
  @ApiProperty({ enum: EstadoReporteTenant })
  @IsEnum(EstadoReporteTenant)
  estado: EstadoReporteTenant;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  respuesta?: string;
}
