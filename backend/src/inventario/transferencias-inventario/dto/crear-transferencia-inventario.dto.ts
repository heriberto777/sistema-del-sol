import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsUUID, ValidateNested } from 'class-validator';

/** Una línea de TransferenciaInventario — mismos campos que TransferirStockDto (sin lotes: transferirStock ya resuelve FEFO internamente). */
export class LineaTransferenciaInventarioDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty({ required: false, description: 'Obligatorio si el producto tiene más de una variante' })
  @IsOptional()
  @IsUUID()
  varianteId?: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;
}

export class CrearTransferenciaInventarioDto {
  @ApiProperty()
  @IsUUID()
  bodegaOrigenId: string;

  @ApiProperty()
  @IsUUID()
  bodegaDestinoId: string;

  @ApiProperty({ type: [LineaTransferenciaInventarioDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaTransferenciaInventarioDto)
  lineas: LineaTransferenciaInventarioDto[];
}
