import { ApiProperty } from '@nestjs/swagger';
import { CategoriaReporteTenant, EstadoReporteTenant } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
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

  @ApiProperty({ required: false, enum: CategoriaReporteTenant })
  @IsOptional()
  @IsEnum(CategoriaReporteTenant)
  categoria?: CategoriaReporteTenant;

  @ApiProperty({ required: false, description: 'Fecha desde (inclusive), YYYY-MM-DD.' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false, description: 'Fecha hasta (inclusive), YYYY-MM-DD.' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
