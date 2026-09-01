import { IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class CatalogoTiendaQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsUUID()
  categoriaId?: string;
}
