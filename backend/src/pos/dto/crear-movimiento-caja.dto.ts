import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class CrearMovimientoCajaDto {
  @ApiProperty({ enum: ['ENTRADA', 'SALIDA'] })
  @IsIn(['ENTRADA', 'SALIDA'])
  tipo: 'ENTRADA' | 'SALIDA';

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  monto: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  concepto: string;
}
