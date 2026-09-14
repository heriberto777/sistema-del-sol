import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsString, Length, Max, Min } from 'class-validator';

export class BuscarHotelesDto {
  @ApiProperty({ description: 'Código de destino de Hotelbeds (ej. "PMI")' })
  @IsString()
  @Length(2, 3)
  destino: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsDateString()
  checkOut: string;

  @ApiProperty({ default: 1, description: 'Fase 1 — una sola habitación por reserva, ver comentario en TravelService.reservarHotel' })
  @IsInt()
  @Min(1)
  @Max(1)
  habitaciones: number;

  @ApiProperty({ default: 2 })
  @IsInt()
  @Min(1)
  @Max(9)
  adultos: number;

  @ApiProperty({ default: 0 })
  @IsInt()
  @Min(0)
  @Max(6)
  ninos: number;
}
