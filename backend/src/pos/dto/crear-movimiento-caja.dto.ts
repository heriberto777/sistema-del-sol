import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { MotivoMovimientoCaja } from '@prisma/client';

export class CrearMovimientoCajaDto {
  @ApiProperty({ enum: ['ENTRADA', 'SALIDA'] })
  @IsIn(['ENTRADA', 'SALIDA'])
  tipo: 'ENTRADA' | 'SALIDA';

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  monto: number;

  @ApiProperty({ enum: MotivoMovimientoCaja, description: 'Categoría estructurada del movimiento (plan de integración Cuadre, ítem F-5)' })
  @IsEnum(MotivoMovimientoCaja)
  motivoTipo: MotivoMovimientoCaja;

  @ApiProperty({ required: false, description: 'Detalle libre opcional, además de la categoría estructurada' })
  @IsOptional()
  @IsString()
  concepto?: string;
}
