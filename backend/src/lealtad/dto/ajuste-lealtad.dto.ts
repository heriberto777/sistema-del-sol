import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, MinLength, NotEquals } from 'class-validator';

export class AjusteLealtadDto {
  @ApiProperty()
  @IsUUID()
  clienteId: string;

  @ApiProperty({ description: 'Positivo para acreditar, negativo para descontar — nunca 0' })
  @IsInt()
  @NotEquals(0)
  puntos: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  motivo: string;
}
