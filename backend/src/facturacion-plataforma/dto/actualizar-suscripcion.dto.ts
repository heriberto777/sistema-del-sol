import { ApiProperty } from '@nestjs/swagger';
import { EstadoSuscripcion } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ActualizarSuscripcionDto {
  @ApiProperty({ required: false, description: '% aplicado una sola vez cuando una factura se vence sin pagar' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  feeMoraPct?: number;

  @ApiProperty({ required: false, enum: EstadoSuscripcion, description: 'CANCELADA pausa la generación automática de facturas' })
  @IsOptional()
  @IsEnum(EstadoSuscripcion)
  estado?: EstadoSuscripcion;

  @ApiProperty({ required: false, description: 'true = la próxima factura automática sale con descuento total (100%, ITBIS incluido) y se apaga sola al aplicarse' })
  @IsOptional()
  @IsBoolean()
  primerPeriodoGratis?: boolean;
}
