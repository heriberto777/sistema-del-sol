import { ApiProperty } from '@nestjs/swagger';
import { EstadoPeriodoNomina } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

/**
 * Un período de nómina no tiene ningún campo de texto libre razonable
 * para buscar (solo tipo/fechas/estado) — se filtra por `estado`
 * (dropdown) en vez de forzar un `busqueda` que no tendría contra qué
 * comparar.
 */
export class ListarPeriodosNominaQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false, enum: EstadoPeriodoNomina })
  @IsOptional()
  @IsEnum(EstadoPeriodoNomina)
  estado?: EstadoPeriodoNomina;
}
