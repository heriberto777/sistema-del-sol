import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class FacturarConsolidadoDto {
  @ApiProperty({ type: [String], description: 'Ids de HitoProyecto a incluir — el service revalida cada uno (sin tareas pendientes, no facturado ya) antes de incluirlo, nunca confía ciegamente en esta lista.' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  hitoIds: string[];
}
