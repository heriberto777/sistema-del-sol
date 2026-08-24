import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class ListarEmpleadosQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false, description: 'Plan de integración Cuadre, ítem G-8.' })
  @IsOptional()
  @IsUUID()
  puestoId?: string;
}
