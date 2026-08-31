import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ConvertirRemisionDto {
  @ApiProperty({ enum: ['CONTADO', 'CREDITO'] })
  @IsIn(['CONTADO', 'CREDITO'])
  tipoFactura: 'CONTADO' | 'CREDITO';

  @ApiProperty({ required: false, description: 'Forma de pago si tipoFactura es CONTADO — captura el cobro al convertir, igual que Factura directa' })
  @IsOptional()
  @IsUUID()
  formaPagoId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  referenciaPago?: string;
}
