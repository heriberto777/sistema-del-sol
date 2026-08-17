import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class ActualizarPlatformAdminDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ required: false, nullable: true, description: 'null quita el rol asignado (sin rol, el admin no puede usar rutas que pidan un permiso puntual)' })
  @IsOptional()
  @IsUUID()
  roleId?: string | null;
}
