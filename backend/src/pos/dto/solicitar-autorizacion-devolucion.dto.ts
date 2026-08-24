import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SolicitarAutorizacionDevolucionDto {
  @ApiProperty()
  @IsUUID()
  facturaOrigenId: string;

  @ApiProperty()
  @IsUUID()
  turnoCajaId: string;
}
