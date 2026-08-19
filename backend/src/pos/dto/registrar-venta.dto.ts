import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { LineaFacturaDto } from '../../facturacion/dto/crear-factura.dto';

export class RegistrarVentaPosDto {
  @ApiProperty()
  @IsUUID()
  turnoCajaId: string;

  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty()
  @IsUUID()
  formaPagoId: string;

  @ApiProperty({ required: false, description: 'Solo aplica si la forma de pago elegida requiere referencia (transferencia, cheque, etc.)' })
  @IsOptional()
  @IsString()
  referenciaPago?: string;

  @ApiProperty({ required: false, description: 'Empleado (cargo "Vendedor") acreditado por comisión en esta venta — distinto del cajero que la registra' })
  @IsOptional()
  @IsUUID()
  vendedorEmpleadoId?: string;

  @ApiProperty({ type: [LineaFacturaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaFacturaDto)
  lineas: LineaFacturaDto[];
}
