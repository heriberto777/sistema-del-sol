import { ApiProperty } from '@nestjs/swagger';
import { MetodoPago } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CrearPagoPlataformaDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  monto: number;

  @ApiProperty({ enum: MetodoPago })
  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  referencia?: string;

  @ApiProperty({ required: false, description: 'Si se omite, se usa la fecha/hora actual' })
  @IsOptional()
  @IsDateString()
  fecha?: string;
}
