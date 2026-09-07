import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class CapturarLineaConteoDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  cantidadContada: number;
}
