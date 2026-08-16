import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class LineaRecepcionDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidadRecibida: number;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  costoUnitario: number;
}

export class RecibirOrdenCompraDto {
  @ApiProperty()
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  facturaProveedorNumero?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  montoFacturaProveedor?: number;

  @ApiProperty({ type: [LineaRecepcionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaRecepcionDto)
  lineas: LineaRecepcionDto[];
}
