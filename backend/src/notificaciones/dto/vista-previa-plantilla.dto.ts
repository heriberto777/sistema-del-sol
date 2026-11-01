import { ApiProperty } from '@nestjs/swagger';
import { CanalNotificacion } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class VistaPreviaPlantillaDto {
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

  @ApiProperty()
  @IsString()
  cuerpo: string;
}
