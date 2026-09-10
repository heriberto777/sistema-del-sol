import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoCobroAlquiler } from '@prisma/client';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class ListadoCobrosAlquilerQueryDto extends ListadoQueryDto {
  @IsOptional()
  @IsUUID()
  contratoPropiedadId?: string;

  @IsOptional()
  @IsEnum(EstadoCobroAlquiler)
  estado?: EstadoCobroAlquiler;
}
