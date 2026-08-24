import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';
import { LineaFacturaDto } from '../../facturacion/dto/crear-factura.dto';

export class PagoVentaPosDto {
  @ApiProperty()
  @IsUUID()
  formaPagoId: string;

  @ApiProperty({ description: 'Monto aplicado a la venta con esta forma de pago (no el efectivo bruto entregado — el cambio nunca se envía)' })
  @IsNumber()
  @IsPositive()
  monto: number;

  @ApiProperty({ required: false, description: 'Solo aplica si la forma de pago elegida requiere referencia (transferencia, cheque, etc.)' })
  @IsOptional()
  @IsString()
  referencia?: string;
}

export class RegistrarVentaPosDto {
  @ApiProperty()
  @IsUUID()
  turnoCajaId: string;

  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ required: false, description: 'Empleado (cargo "Vendedor") acreditado por comisión en esta venta — distinto del cajero que la registra' })
  @IsOptional()
  @IsUUID()
  vendedorEmpleadoId?: string;

  @ApiProperty({
    type: [PagoVentaPosDto],
    description: 'Uno o más pagos que en conjunto cubren el total de la venta — soporta pago dividido (ej. parte efectivo + parte tarjeta)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PagoVentaPosDto)
  pagos: PagoVentaPosDto[];

  @ApiProperty({ type: [LineaFacturaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaFacturaDto)
  lineas: LineaFacturaDto[];

  @ApiProperty({
    required: false,
    description:
      'Nivel de precio para esta venta puntual. Si se omite, se usa el listaPrecioId del cliente (o "GENERAL" si no tiene uno asignado).',
  })
  @IsOptional()
  @IsString()
  listaPrecio?: string;

  @ApiProperty({
    required: false,
    default: 'CONTADO',
    enum: ['CONTADO', 'CREDITO'],
    description:
      'Tipo de comprobante de la venta (plan de integración Cuadre, ítem F-2) — antes siempre CONTADO. Solo CONTADO/CREDITO: una venta de POS nunca es NOTA_CREDITO/NOTA_DEBITO (eso es registrarDevolucion).',
  })
  @IsOptional()
  @IsIn(['CONTADO', 'CREDITO'])
  tipoFactura?: 'CONTADO' | 'CREDITO';

  @ApiProperty({
    required: false,
    enum: ['REGIMEN_ESPECIAL', 'GUBERNAMENTAL'],
    description: 'Igual que en Facturación (ítem B-1) — usa B14/B15 (o su e-CF) en vez del NCF normal.',
  })
  @IsOptional()
  @IsEnum(['REGIMEN_ESPECIAL', 'GUBERNAMENTAL'])
  tipoComprobanteEspecial?: 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL';
}
