import { ApiProperty } from '@nestjs/swagger';
import { CategoriaReporteTenant } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearReporteTenantDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  asunto: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  descripcion: string;

  @ApiProperty({ enum: CategoriaReporteTenant })
  @IsEnum(CategoriaReporteTenant)
  categoria: CategoriaReporteTenant;
}
