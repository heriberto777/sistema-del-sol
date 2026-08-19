import { ApiProperty } from '@nestjs/swagger';
import { AlcanceOferta, TipoDescuentoOferta } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, MinLength, ValidateIf } from 'class-validator';

export class CrearOfertaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  nombre: string;

  @ApiProperty({ enum: TipoDescuentoOferta })
  @IsEnum(TipoDescuentoOferta)
  tipoDescuento: TipoDescuentoOferta;

  @ApiProperty({ description: '% (0-100) si PORCENTAJE, monto RD$ si MONTO_FIJO' })
  @IsNumber()
  @IsPositive()
  @ValidateIf((o) => o.tipoDescuento === 'PORCENTAJE')
  @Max(100, { message: 'Un descuento porcentual no puede superar 100' })
  valor: number;

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

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  fechaInicio: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  fechaFin: Date;
}
