import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class MarcarLineaConciliadaDto {
  @ApiProperty()
  @IsBoolean()
  conciliado: boolean;
}
