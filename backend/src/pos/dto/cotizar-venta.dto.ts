import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { LineaFacturaDto } from '../../facturacion/dto/crear-factura.dto';

export class CotizarVentaPosDto {
  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ type: [LineaFacturaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaFacturaDto)
  lineas: LineaFacturaDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  listaPrecio?: string;
}
