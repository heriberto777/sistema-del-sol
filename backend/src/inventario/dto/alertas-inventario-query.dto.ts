import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export type CategoriaAlertaInventario = 'sinStock' | 'stockBajo' | 'porVencer' | 'vencidos';

/** Ítem E-12 — listado paginado por categoría, detrás de las 4 tarjetas de conteo de `GET /reportes/dashboard` (ítem E-4). */
export class AlertasInventarioQueryDto extends ListadoQueryDto {
  @ApiProperty({ enum: ['sinStock', 'stockBajo', 'porVencer', 'vencidos'] })
  @IsIn(['sinStock', 'stockBajo', 'porVencer', 'vencidos'])
  categoria: CategoriaAlertaInventario;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  sucursalId?: string;
}
