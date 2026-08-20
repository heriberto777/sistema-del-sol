import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

/** `registros_asistencia` crece sin límite (una fila por empleado por día) — sigue el contrato paginado, ver CLAUDE.md. */
export class ListarAsistenciaQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  empleadoId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
