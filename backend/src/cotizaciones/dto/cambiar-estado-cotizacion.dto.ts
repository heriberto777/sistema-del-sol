import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CambiarEstadoCotizacionDto {
  @ApiProperty({ enum: ['ENVIADA', 'ACEPTADA', 'RECHAZADA'] })
  @IsIn(['ENVIADA', 'ACEPTADA', 'RECHAZADA'])
  estado: 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA';
}
