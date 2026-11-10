import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ExtraerFacturaProveedorDto {
  @ApiProperty({ description: 'Data URI completa (data:image/...;base64,... o data:application/pdf;base64,...)' })
  @IsString()
  @Matches(/^data:(image\/[a-z]+|application\/pdf);base64,.+$/, { message: 'archivo debe ser una imagen o PDF en formato data URI' })
  archivo: string;
}
