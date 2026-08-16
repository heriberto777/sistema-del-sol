import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ActualizarConfiguracionDto {
  @ApiProperty()
  @IsString()
  valor: string;
}
