import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { CrearPagoDto } from '../../pagos/dto/crear-pago.dto';

/**
 * Retención de ISR/ITBIS practicada al proveedor (Art. 309/349) — exclusiva
 * de pagos a OrdenCompra, ingresada a mano por quien registra el pago (ver
 * PagosService.registrarPagoOrdenCompra). CrearPagoDto (compartido con
 * Facturación) queda sin estos campos: un cliente nunca le retiene al
 * tenant por este flujo.
 */
export class CrearPagoOrdenCompraDto extends CrearPagoDto {
  @ApiProperty({ required: false, description: 'Monto de ISR retenido al proveedor, en RD$' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  retencionIsr?: number;

  @ApiProperty({ required: false, description: 'Monto de ITBIS retenido al proveedor, en RD$' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  retencionItbis?: number;
}
