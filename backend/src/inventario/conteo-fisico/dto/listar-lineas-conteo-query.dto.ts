import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ListadoQueryDto } from '../../../common/dto/listado-query.dto';

export type FiltroLineaConteo = 'TODAS' | 'CONTADAS' | 'SIN_CONTAR' | 'CON_FALTANTE' | 'CON_SOBRANTE' | 'SIN_DIFERENCIA';

const FILTROS_LINEA_CONTEO: FiltroLineaConteo[] = ['TODAS', 'CONTADAS', 'SIN_CONTAR', 'CON_FALTANTE', 'CON_SOBRANTE', 'SIN_DIFERENCIA'];

/**
 * `busqueda` (heredado de `ListadoQueryDto`) filtra por código de
 * producto, SKU de variante, código de barras o nombre del producto —
 * ver `ConteoFisicoRepository.listarLineas`.
 */
export class ListarLineasConteoQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false, enum: FILTROS_LINEA_CONTEO })
  @IsOptional()
  @IsIn(FILTROS_LINEA_CONTEO)
  filtro?: FiltroLineaConteo;
}
