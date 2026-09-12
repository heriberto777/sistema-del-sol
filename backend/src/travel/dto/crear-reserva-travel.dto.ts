import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Length, Min, MaxLength, ValidateNested } from 'class-validator';
import { TipoTravelReserva } from '@prisma/client';
import { CrearPasajeroTravelDto } from './crear-pasajero-travel.dto';

export class CrearReservaTravelDto {
  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ enum: TipoTravelReserva })
  @IsEnum(TipoTravelReserva)
  tipo: TipoTravelReserva;

  @ApiProperty({ required: false, default: 'USD', description: 'Solo DOP se puede facturar hoy — ver TravelService.facturar' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  moneda?: string;

  @ApiProperty({ description: 'Lo que cuesta/costará contra el proveedor' })
  @IsNumber()
  @Min(0)
  montoCosto: number;

  @ApiProperty({ description: 'Lo que se le cobra al cliente (costo + markup + fee)' })
  @IsNumber()
  @Min(0)
  montoVenta: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;

  @ApiProperty({ required: false, type: [CrearPasajeroTravelDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => CrearPasajeroTravelDto)
  pasajeros?: CrearPasajeroTravelDto[];
}
