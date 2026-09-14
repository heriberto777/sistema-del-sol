import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerarDescripcionTareaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  titulo: string;

  @ApiProperty({ required: false, description: 'Nombre del renglón de incentivo elegido, si aplica — da contexto extra a la IA' })
  @IsOptional()
  @IsString()
  categoria?: string;
}
