import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class ConvertirCotizacionDto {
  @ApiProperty({ description: 'Bodega desde la que se descuenta el inventario al facturar' })
  @IsUUID()
  bodegaId: string;

  @ApiProperty({ enum: ['CONTADO', 'CREDITO'] })
  @IsIn(['CONTADO', 'CREDITO'])
  tipoFactura: 'CONTADO' | 'CREDITO';
}
