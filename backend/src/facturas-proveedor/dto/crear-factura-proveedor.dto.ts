import { ApiProperty } from '@nestjs/swagger';
import { TipoFacturaProveedor, TipoNcf } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class LineaFacturaProveedorDto {
  @ApiProperty({ description: 'Cuenta de gasto (tipo GASTO) que se debita' })
  @IsUUID()
  cuentaContableId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  concepto?: string;

  @ApiProperty({ description: 'Monto antes de impuesto, por unidad' })
  @IsNumber()
  @IsPositive()
  valor: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeItbis?: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  cantidad?: number;
}

export class CrearFacturaProveedorDto {
  @ApiProperty()
  @IsUUID()
  proveedorId: string;

  @ApiProperty({ enum: TipoFacturaProveedor, required: false, default: 'FACTURA' })
  @IsOptional()
  @IsEnum(TipoFacturaProveedor)
  tipo?: TipoFacturaProveedor;

  @ApiProperty({ required: false, description: 'Obligatorio si tipo es NOTA_CREDITO — la FacturaProveedor que ajusta' })
  @IsOptional()
  @IsUUID()
  facturaOrigenId?: string;

  @ApiProperty({ description: 'NCF que el proveedor emitió (comprobante real que entregó)' })
  @IsString()
  ncfProveedor: string;

  @ApiProperty({ enum: TipoNcf })
  @IsEnum(TipoNcf)
  tipoNcfProveedor: TipoNcf;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  concepto?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({ required: false, description: 'Si se omite, se usa Proveedor.plazoPagoDias' })
  @IsOptional()
  @IsUUID()
  terminoPagoId?: string;

  @ApiProperty({ type: [LineaFacturaProveedorDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaFacturaProveedorDto)
  lineas: LineaFacturaProveedorDto[];
}
