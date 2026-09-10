import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoContratoPropiedad, OperacionPropiedad } from '@prisma/client';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class ListadoContratosQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsEnum(EstadoContratoPropiedad)
  estado?: EstadoContratoPropiedad;

  @IsOptional()
  @IsEnum(OperacionPropiedad)
  tipo?: OperacionPropiedad;

  @IsOptional()
  @IsUUID()
  agenteId?: string;
}
