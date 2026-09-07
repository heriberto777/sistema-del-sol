import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class GenerarCodigoBarrasDto {
  @ApiProperty({ enum: ['EAN13', 'CODE128'] })
  @IsIn(['EAN13', 'CODE128'])
  formato: 'EAN13' | 'CODE128';
}
