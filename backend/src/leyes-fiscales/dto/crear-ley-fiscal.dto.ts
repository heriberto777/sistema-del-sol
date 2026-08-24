import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CrearLeyFiscalDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  codigo: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiProperty({ description: 'Ej: 10 = solo se paga 10% del ITBIS normal del producto (18% → 1.8% efectivo).' })
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeItbisAPagar: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
