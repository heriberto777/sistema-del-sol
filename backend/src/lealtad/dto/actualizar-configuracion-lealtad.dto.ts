import { ApiProperty } from '@nestjs/swagger';
import { CalculoLealtad, ModoAcumulacionLealtad } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class ActualizarConfiguracionLealtadDto {
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ enum: ModoAcumulacionLealtad, required: false, default: 'POR_MONTO' })
  @IsOptional()
  @IsEnum(ModoAcumulacionLealtad)
  modoAcumulacion?: ModoAcumulacionLealtad;

  @ApiProperty({ required: false, nullable: true, description: 'RD$ por cada punto ganado — obligatorio si modoAcumulacion=POR_MONTO' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  montoPorPunto?: number | null;

  @ApiProperty({ enum: CalculoLealtad, required: false, default: 'SUBTOTAL', description: 'Base de cálculo cuando modoAcumulacion=POR_MONTO — subtotal (sin ITBIS) o total (con ITBIS)' })
  @IsOptional()
  @IsEnum(CalculoLealtad)
  calcularSobre?: CalculoLealtad;

  @ApiProperty({ required: false, default: true, description: 'Si es false, una línea con cualquier descuento (manual, Oferta o general) no genera puntos' })
  @IsOptional()
  @IsBoolean()
  itemsConDescuentoGeneranPuntos?: boolean;

  @ApiProperty({ required: false, default: 0, description: 'RD$ que vale UN punto al canjear — 0 rechaza cualquier canje' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorPunto?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minimoParaCanjear?: number;

  @ApiProperty({ required: false, nullable: true, description: 'Días hasta que un punto ganado expira — null explícito = nunca expiran' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  diasExpiracion?: number | null;
}
