import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CambiarEstadoAusenciaDto {
  @ApiProperty({ enum: ['APROBADA', 'RECHAZADA'] })
  @IsIn(['APROBADA', 'RECHAZADA'])
  estado: 'APROBADA' | 'RECHAZADA';
}
