import { ApiProperty } from '@nestjs/swagger';
import { TipoCuentaContable, NaturalezaCuenta } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CrearCuentaContableDto {
  @ApiProperty()
  @IsString()
  codigo: string;

  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ enum: TipoCuentaContable })
  @IsEnum(TipoCuentaContable)
  tipo: TipoCuentaContable;

  @ApiProperty({ enum: NaturalezaCuenta })
  @IsEnum(NaturalezaCuenta)
  naturaleza: NaturalezaCuenta;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  cuentaPadreId?: string;
}
