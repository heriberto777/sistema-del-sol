import { IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

/** `busqueda` matchea contra `accion`/`entidad` (ver AuditoriaRepository). */
export class ListarAuditoriaQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;
}
