import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Length, MaxLength, Min, ValidateNested } from 'class-validator';

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

  @ApiProperty({ enum: ['mr', 'mrs', 'ms', 'miss', 'dr'], description: 'Duffel lo exige siempre — confirmado contra el sandbox real' })
  @IsEnum(['mr', 'mrs', 'ms', 'miss', 'dr'])
  titulo: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  telefono: string;

  // Pasaporte (APIS) — opcional: no toda ruta/aerolínea lo exige, pero Duffel lo acepta sin error si se manda (confirmado contra el sandbox real).
  @ApiProperty({ required: false, description: 'Recomendado para vuelos internacionales — si se completa uno de los 3 campos, hay que completar los 3' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  numeroPasaporte?: string;

  @ApiProperty({ required: false, description: 'ISO 3166-1 alpha-2 (ej. "DO")' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  paisEmisionPasaporte?: string;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  fechaVencimientoPasaporte?: string;

  @ApiProperty({
    required: false,
    description: 'Solo en el pasajero ADULTO responsable: el id del pasajero infante (infant_without_seat) que viaja con él — Duffel lo exige si hay algún infante en la oferta',
  })
  @IsOptional()
  @IsString()
  infantePasajeroId?: string;
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
