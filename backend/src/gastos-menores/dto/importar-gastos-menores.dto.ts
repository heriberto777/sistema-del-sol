import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, Max, Min, MinLength, ValidateNested } from 'class-validator';

/**
 * Fase 11.1 del benchmark (Cuadre tiene import masivo de Gastos que
 * alimenta el 606 directo) — una fila = un GastoMenor con UNA sola línea
 * (el caso real de "mercado informal": un concepto, un monto). No
 * soporta gastos con varias líneas por fila, ni asociarlos a un proyecto
 * — eso sigue siendo "crear uno por uno" desde la pantalla, mismo
 * criterio que la importación de Productos deja fuera COMBOs/variantes.
 *
 * `cuentaBancaria`/`cuentaContable` son texto libre (lo que el usuario ve
 * en los selects de "Nuevo gasto menor": "Banco — NúmeroCuenta" y
 * "Código — Nombre" o solo el nombre) — se resuelven contra el catálogo
 * real del tenant en `GastosMenoresService.importar`, nunca un id.
 */
export class FilaImportarGastoMenorDto {
  @ApiProperty({ required: false, description: 'Si se omite, usa la fecha de hoy — mismo default que crear un gasto menor uno por uno.' })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({ description: 'Texto a resolver contra las cuentas bancarias del tenant — "Banco — NúmeroCuenta", o solo el banco si no es ambiguo.' })
  @IsString()
  @MinLength(1)
  cuentaBancaria: string;

  @ApiProperty({ description: 'Texto a resolver contra el catálogo de cuentas (tipo Gasto) del tenant — código o nombre exacto.' })
  @IsString()
  @MinLength(1)
  cuentaContable: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  concepto?: string;

  @ApiProperty({ description: 'Monto sin ITBIS de esta línea.' })
  @IsNumber()
  @Min(0)
  valor: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeItbis?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  cantidad?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notas?: string;
}

export class ImportarGastosMenoresDto {
  @ApiProperty({ type: [FilaImportarGastoMenorDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FilaImportarGastoMenorDto)
  gastos: FilaImportarGastoMenorDto[];
}
