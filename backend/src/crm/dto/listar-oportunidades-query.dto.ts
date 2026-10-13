import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoOportunidad } from '@prisma/client';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class ListarOportunidadesQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsEnum(EstadoOportunidad)
  estado?: EstadoOportunidad;

  @IsOptional()
  @IsUUID()
  vendedorId?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
