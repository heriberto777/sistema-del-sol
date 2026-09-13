import { ApiProperty } from '@nestjs/swagger';
import { TipoTravelReserva } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class CrearReglaMarkupDto {
  @ApiProperty({ required: false, enum: TipoTravelReserva, description: 'Sin especificar = regla global (aplica a VUELO y HOTEL si no hay una más específica activa)' })
  @IsOptional()
  @IsEnum(TipoTravelReserva)
  tipo?: TipoTravelReserva;

  @ApiProperty({ required: false, description: 'Ej. 12.5 = +12.5% sobre el costo — exactamente uno de porcentaje/montoFijo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  porcentaje?: number;

  @ApiProperty({ required: false, description: 'Monto fijo agregado al costo — exactamente uno de porcentaje/montoFijo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoFijo?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
