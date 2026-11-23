import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ReporteFiscalQueryDto } from '../../reportes-fiscales/dto/reporte-fiscal-query.dto';

/** Centro de Costo (docs/PLAN.md, punto 3) — filtro propio del Estado de Resultados, fuera de ReporteFiscalQueryDto (compartido con 606/607/608). */
export class EstadoResultadosQueryDto extends ReporteFiscalQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  centroCostoId?: string;
}
