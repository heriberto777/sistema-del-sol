import { ApiProperty } from '@nestjs/swagger';
import { CanalNotificacion } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CrearPlantillaDto {
  @ApiProperty({ enum: CanalNotificacion })
  @IsEnum(CanalNotificacion)
  canal: CanalNotificacion;

  @ApiProperty({ example: 'factura_creada' })
  @IsString()
  clave: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  asunto?: string;

  @ApiProperty({ example: 'Hola {{cliente_nombre}}, tu factura {{factura_ncf}} por {{factura_total}} fue emitida.' })
  @IsString()
  cuerpo: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
