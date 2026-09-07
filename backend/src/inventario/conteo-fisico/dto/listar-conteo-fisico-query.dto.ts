import { ApiProperty } from '@nestjs/swagger';
import { EstadoConteoFisico } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../../common/dto/listado-query.dto';

export class ListarConteoFisicoQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  bodegaId?: string;

  @ApiProperty({ required: false, enum: EstadoConteoFisico })
  @IsOptional()
  @IsEnum(EstadoConteoFisico)
  estado?: EstadoConteoFisico;
}
