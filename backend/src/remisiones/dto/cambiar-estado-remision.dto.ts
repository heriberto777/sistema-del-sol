import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CambiarEstadoRemisionDto {
  @ApiProperty({ enum: ['ENTREGADA', 'ANULADA'] })
  @IsIn(['ENTREGADA', 'ANULADA'])
  estado: 'ENTREGADA' | 'ANULADA';
}
