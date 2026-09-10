import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ActivarAdministracionAlquilerDto {
  @ApiProperty({ description: '% del alquiler cobrado que se queda la agencia como comisión de administración' })
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeComisionAdministracion: number;

  @ApiProperty({ required: false, description: 'Fecha del primer cobro a generar — por defecto, ahora' })
  @IsOptional()
  @IsDateString()
  proximoCobroAlquilerEn?: string;
}
