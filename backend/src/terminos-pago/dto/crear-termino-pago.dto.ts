import { ApiProperty } from '@nestjs/swagger';
import { AplicaTerminoPago } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CrearTerminoPagoDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  nombre: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  dias: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  descuentoProntoPagoPct?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  diasProntoPago?: number;

  @ApiProperty({ required: false, enum: AplicaTerminoPago, default: AplicaTerminoPago.AMBOS })
  @IsOptional()
  @IsEnum(AplicaTerminoPago)
  aplicaA?: AplicaTerminoPago;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
