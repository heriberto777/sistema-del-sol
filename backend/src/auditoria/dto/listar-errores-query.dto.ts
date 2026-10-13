import { IsISO8601, IsOptional } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

/** `busqueda` matchea contra `mensaje`/`ruta` (ver AuditoriaRepository). */
export class ListarErroresQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;
}
