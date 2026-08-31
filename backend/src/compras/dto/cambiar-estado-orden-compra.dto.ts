import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Ítem E-1 — activa BORRADOR→ENVIADA (confirmar) y BORRADOR|ENVIADA→CANCELADA, vestigiales en el enum hasta ahora. */
export class CambiarEstadoOrdenCompraDto {
  @ApiProperty({ enum: ['ENVIADA', 'CANCELADA'] })
  @IsIn(['ENVIADA', 'CANCELADA'])
  estado: 'ENVIADA' | 'CANCELADA';
}
