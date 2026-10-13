import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoLead } from '@prisma/client';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class ListarLeadsQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsEnum(EstadoLead)
  estado?: EstadoLead;

  @IsOptional()
  @IsUUID()
  vendedorId?: string;
}
