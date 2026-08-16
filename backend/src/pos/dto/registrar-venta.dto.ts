import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsUUID, ValidateNested } from 'class-validator';
import { LineaFacturaDto } from '../../facturacion/dto/crear-factura.dto';

export class RegistrarVentaPosDto {
  @ApiProperty()
  @IsUUID()
  turnoCajaId: string;

  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] })
  @IsIn(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'])
  metodoPago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

  @ApiProperty({ type: [LineaFacturaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaFacturaDto)
  lineas: LineaFacturaDto[];
}
