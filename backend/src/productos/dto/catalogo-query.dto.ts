import { IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class CatalogoQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsUUID()
  categoriaId?: string;
}
