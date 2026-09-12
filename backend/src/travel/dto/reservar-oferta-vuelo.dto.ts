import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class PasajeroReservaVueloDto {
  @ApiProperty({ description: 'Debe coincidir con un id de pasajero devuelto por la oferta del proveedor' })
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  nombre: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  apellido: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsDateString()
  fechaNacimiento: string;

  @ApiProperty({ enum: ['m', 'f'] })
  @IsEnum(['m', 'f'])
  genero: 'm' | 'f';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  titulo?: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  telefono: string;
}

export class ReservarOfertaVueloDto {
  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ description: 'Id de la oferta devuelta por /admin/travel/vuelos/buscar — se re-cotiza antes de reservar, nunca se confía en el precio cacheado' })
  @IsString()
  ofertaId: string;

  @ApiProperty({ type: [PasajeroReservaVueloDto] })
  @ValidateNested({ each: true })
  @Type(() => PasajeroReservaVueloDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  pasajeros: PasajeroReservaVueloDto[];

  @ApiProperty({ description: 'Lo que se le cobra al cliente — el costo real lo determina el re-price de la oferta, nunca lo que mande el frontend' })
  @IsNumber()
  @Min(0)
  montoVenta: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;
}
