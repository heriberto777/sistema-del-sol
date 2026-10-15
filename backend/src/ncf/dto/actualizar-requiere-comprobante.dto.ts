import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ActualizarRequiereComprobanteDto {
  @ApiProperty()
  @IsBoolean()
  requiereComprobanteFiscal: boolean;
}
