import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class LineaDevolucionPosDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  cantidad: number;
}

export class RegistrarDevolucionDto {
  @ApiProperty({ description: 'Factura EMITIDA (CONTADO/CREDITO) sobre la que se emite la nota de crédito' })
  @IsUUID()
  facturaOrigenId: string;

  @ApiProperty()
  @IsUUID()
  turnoCajaId: string;

  @ApiProperty({ description: 'Forma de pago con la que se reintegra al cliente' })
  @IsUUID()
  formaPagoId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  referenciaPago?: string;

  @ApiProperty({ type: [LineaDevolucionPosDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaDevolucionPosDto)
  lineas: LineaDevolucionPosDto[];
}
