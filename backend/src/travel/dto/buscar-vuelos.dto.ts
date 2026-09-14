import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

export class TramoBusquedaVueloDto {
  @ApiProperty({ description: 'Código IATA de 3 letras (ej. "SDQ")' })
  @IsString()
  @Length(3, 3)
  origen: string;

  @ApiProperty({ description: 'Código IATA de 3 letras (ej. "MAD")' })
  @IsString()
  @Length(3, 3)
  destino: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsDateString()
  fecha: string;
}

export class PasajeroBusquedaVueloDto {
  @ApiProperty({
    required: false,
    enum: ['adult', 'child', 'infant_without_seat'],
    description: 'Para niños/bebés es mejor mandar "edad" — Duffel exige uno u otro, nunca ambos (confirmado contra el sandbox real)',
  })
  @IsOptional()
  @IsEnum(['adult', 'child', 'infant_without_seat'])
  tipo?: 'adult' | 'child' | 'infant_without_seat';

  @ApiProperty({ required: false, description: 'Edad exacta (0-17) — cada aerolínea decide su propio corte adulto/niño/bebé según esto' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(17)
  edad?: number;
}

export class BuscarVuelosDto {
  @ApiProperty({ type: [TramoBusquedaVueloDto], description: 'Un tramo = solo ida; dos = ida y vuelta; más = multi-destino' })
  @ValidateNested({ each: true })
  @Type(() => TramoBusquedaVueloDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  tramos: TramoBusquedaVueloDto[];

  @ApiProperty({ type: [PasajeroBusquedaVueloDto] })
  @ValidateNested({ each: true })
  @Type(() => PasajeroBusquedaVueloDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  pasajeros: PasajeroBusquedaVueloDto[];

  @ApiProperty({ required: false, enum: ['economy', 'premium_economy', 'business', 'first'] })
  @IsOptional()
  @IsEnum(['economy', 'premium_economy', 'business', 'first'])
  cabina?: 'economy' | 'premium_economy' | 'business' | 'first';
}
