import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CambiarEstadoPublicacionSocialDto {
  @ApiProperty({ enum: ['APROBADA', 'RECHAZADA'] })
  @IsIn(['APROBADA', 'RECHAZADA'])
  estado: 'APROBADA' | 'RECHAZADA';

  // Obligatorio solo si estado === 'RECHAZADA' — se valida en el service
  // (condicional, no alcanza con un decorador declarativo de class-validator).
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  motivoRechazo?: string;
}
