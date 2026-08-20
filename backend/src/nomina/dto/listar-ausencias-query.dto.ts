import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

const ESTADOS_AUSENCIA = ['SOLICITADA', 'APROBADA', 'RECHAZADA'] as const;

export class ListarAusenciasQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  empleadoId?: string;

  @ApiProperty({ required: false, enum: ESTADOS_AUSENCIA })
  @IsOptional()
  @IsIn(ESTADOS_AUSENCIA)
  estado?: (typeof ESTADOS_AUSENCIA)[number];
}
