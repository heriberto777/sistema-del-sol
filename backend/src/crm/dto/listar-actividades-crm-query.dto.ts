import { IsBooleanString, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class ListarActividadesCrmQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsUUID()
  oportunidadId?: string;

  @IsOptional()
  @IsBooleanString()
  completada?: string;
}
