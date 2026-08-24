import { ApiProperty } from '@nestjs/swagger';
import { AlcanceOferta, TipoDescuentoOferta } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min, MinLength, ValidateIf } from 'class-validator';

export class CrearOfertaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  nombre: string;

  @ApiProperty({ enum: TipoDescuentoOferta })
  @IsEnum(TipoDescuentoOferta)
  tipoDescuento: TipoDescuentoOferta;

  @ApiProperty({ required: false, description: '% (0-100) si PORCENTAJE, monto RD$ si MONTO_FIJO — no aplica (ignorado) si BOGO' })
  @ValidateIf((o) => o.tipoDescuento !== 'BOGO')
  @IsNumber()
  @IsPositive()
  @ValidateIf((o) => o.tipoDescuento === 'PORCENTAJE')
  @Max(100, { message: 'Un descuento porcentual no puede superar 100' })
  valor?: number;

  @ApiProperty({ required: false, description: 'Obligatorio si tipoDescuento=BOGO — cuántas unidades hay que comprar para activar el descuento (la "X" de "Compra X Lleva Y")' })
  @ValidateIf((o) => o.tipoDescuento === 'BOGO')
  @IsInt()
  @IsPositive()
  comprarCantidad?: number;

  @ApiProperty({ required: false, description: 'Obligatorio si tipoDescuento=BOGO — cuántas unidades adicionales llevan el descuento (la "Y" de "Compra X Lleva Y"; 1 = "Segunda Unidad")' })
  @ValidateIf((o) => o.tipoDescuento === 'BOGO')
  @IsInt()
  @IsPositive()
  llevarCantidad?: number;

  @ApiProperty({
    required: false,
    default: 100,
    description: 'Solo BOGO — % de descuento sobre las unidades "llevadas": 100 = gratis, 50 = "segunda unidad a mitad de precio"',
  })
  @IsOptional()
  @ValidateIf((o) => o.tipoDescuento === 'BOGO')
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeDescuentoLlevar?: number;

  @ApiProperty({ required: false, description: 'Tope de descuento en RD$ — sin esto, sin límite (más allá del propio monto de la línea/carrito)' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  descuentoMaximoMonto?: number;

  @ApiProperty({ required: false, default: false, description: 'Si es true, esta oferta se SUMA a otras ofertas acumulables que también matcheen; si es false (default), compite con las demás ofertas no acumulables y solo gana la de mayor descuento' })
  @IsOptional()
  @IsBoolean()
  acumulable?: boolean;

  @ApiProperty({ required: false, default: 0, description: 'Desempate entre ofertas NO acumulables con el mismo descuento resultante — menor número = mayor prioridad' })
  @IsOptional()
  @IsInt()
  prioridad?: number;

  @ApiProperty({ required: false, default: true, description: 'Si una venta bajo esta oferta cuenta para el cálculo de comisión del vendedor (ítem A-1) — sin efecto hasta que A-1 esté implementado' })
  @IsOptional()
  @IsBoolean()
  pagaComision?: boolean;

  @ApiProperty({ enum: AlcanceOferta })
  @IsEnum(AlcanceOferta)
  alcance: AlcanceOferta;

  @ApiProperty({ required: false, description: 'Obligatorio si alcance=PRODUCTO' })
  @ValidateIf((o) => o.alcance === 'PRODUCTO')
  @IsUUID()
  productoId?: string;

  @ApiProperty({ required: false, description: 'Obligatorio si alcance=CATEGORIA' })
  @ValidateIf((o) => o.alcance === 'CATEGORIA')
  @IsUUID()
  categoriaId?: string;

  @ApiProperty({ required: false, description: 'Solo alcance=CARRITO — sin esto, aplica sin mínimo de compra' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  montoMinimoCarrito?: number;

  @ApiProperty({ description: 'Fecha y hora de inicio de vigencia — ítem A-2, admite hora exacta, no solo el día' })
  @Type(() => Date)
  @IsDate()
  fechaInicio: Date;

  @ApiProperty({ description: 'Fecha y hora de fin de vigencia' })
  @Type(() => Date)
  @IsDate()
  fechaFin: Date;
}
