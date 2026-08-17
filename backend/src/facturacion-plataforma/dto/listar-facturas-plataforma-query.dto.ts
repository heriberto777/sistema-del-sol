import { ApiProperty } from '@nestjs/swagger';
import { EstadoFacturaPlataforma } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class ListarFacturasPlataformaQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiProperty({ required: false, enum: EstadoFacturaPlataforma })
  @IsOptional()
  @IsEnum(EstadoFacturaPlataforma)
  estado?: EstadoFacturaPlataforma;
}
