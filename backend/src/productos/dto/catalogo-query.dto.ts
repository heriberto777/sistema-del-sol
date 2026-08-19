import { IsOptional, IsString } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class CatalogoQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsString()
  categoria?: string;
}
