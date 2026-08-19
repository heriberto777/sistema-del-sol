import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class CrearPrecioDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({
    required: false,
    description:
      'Obligatorio si el producto tiene más de una variante (Fase 3c) — sin esto, no hay forma de saber a cuál de las variantes reales le corresponde este precio.',
  })
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @ApiProperty({ default: 'GENERAL' })
  @IsOptional()
  @IsString()
  listaPrecio?: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  costo: number;

  @ApiProperty({ required: false, description: 'Si se omite, se calcula desde precioVenta' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  margenPct?: number;

  @ApiProperty({ required: false, description: 'Si se omite, se calcula desde costo + margenPct' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioVenta?: number;
}
