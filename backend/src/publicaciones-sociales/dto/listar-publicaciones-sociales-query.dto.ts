import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

const ESTADOS_PUBLICACION_SOCIAL = ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA'] as const;

export class ListarPublicacionesSocialesQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false, enum: ESTADOS_PUBLICACION_SOCIAL })
  @IsOptional()
  @IsIn(ESTADOS_PUBLICACION_SOCIAL)
  estado?: (typeof ESTADOS_PUBLICACION_SOCIAL)[number];
}
