import { IsBooleanString, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class CatalogoTiendaQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  /** Fase 11 — filtra la sección "Destacados" del storefront ('true'/'false', como cualquier query param); sin mandarlo, el catálogo se comporta exactamente igual que antes. */
  @IsOptional()
  @IsBooleanString()
  destacado?: string;
}
