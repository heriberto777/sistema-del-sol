import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ConvertirRemisionDto {
  @ApiProperty({ enum: ['CONTADO', 'CREDITO'] })
  @IsIn(['CONTADO', 'CREDITO'])
  tipoFactura: 'CONTADO' | 'CREDITO';
}
