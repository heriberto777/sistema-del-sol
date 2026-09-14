import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class HuespedReservaHotelDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  nombre: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  apellido: string;

  @ApiProperty({ enum: ['AD', 'CH'], description: 'AD = adulto, CH = niño' })
  @IsEnum(['AD', 'CH'])
  tipo: 'AD' | 'CH';
}

export class ReservarHotelDto {
  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ description: 'rateKey devuelto por /admin/travel/hoteles/buscar — se re-cotiza antes de reservar, nunca se confía en el precio cacheado' })
  @IsString()
  rateKey: string;

  @ApiProperty({ type: [HuespedReservaHotelDto] })
  @ValidateNested({ each: true })
  @Type(() => HuespedReservaHotelDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  huespedes: HuespedReservaHotelDto[];

  @ApiProperty({ description: 'Lo que se le cobra al cliente — el costo real lo determina la re-cotización de la tarifa, nunca lo que mande el frontend' })
  @IsNumber()
  @Min(0)
  montoVenta: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;
}
