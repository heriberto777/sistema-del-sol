import { ApiProperty } from '@nestjs/swagger';
import { ModalidadFacturacion } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ActualizarModalidadFacturacionDto {
  @ApiProperty({ enum: ModalidadFacturacion })
  @IsEnum(ModalidadFacturacion)
  modalidad: ModalidadFacturacion;
}
