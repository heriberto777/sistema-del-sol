import { ApiProperty } from '@nestjs/swagger';
import { EstadoReporteTenant } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

/** Lado plataforma — lista de TODOS los tenants, filtrable. El lado tenant no necesita filtros (siempre son los suyos). */
export class ListarReportesTenantQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiProperty({ required: false, enum: EstadoReporteTenant })
  @IsOptional()
  @IsEnum(EstadoReporteTenant)
  estado?: EstadoReporteTenant;
}
