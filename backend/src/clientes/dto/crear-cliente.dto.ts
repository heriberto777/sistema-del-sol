import { ApiProperty } from '@nestjs/swagger';
import { CondicionPago, TipoCliente, TipoComprobanteFiscal } from '@prisma/client';
import { IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CrearClienteDto {
  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiProperty({ enum: TipoCliente, default: TipoCliente.PERSONA_FISICA })
  @IsEnum(TipoCliente)
  tipo: TipoCliente;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rncCedula?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteCredito?: number;

  @ApiProperty({ required: false, description: 'Nivel de precio por defecto de este cliente. Si se omite/null, resuelve a "GENERAL" al facturar.' })
  @IsOptional()
  @IsUUID()
  listaPrecioId?: string | null;

  @ApiProperty({ required: false, description: 'Categoría/segmentación de cliente (plan de integración Cuadre, ítem E-5) — puramente informativa.' })
  @IsOptional()
  @IsUUID()
  categoriaId?: string | null;

  @ApiProperty({
    required: false,
    enum: TipoComprobanteFiscal,
    description: 'Comprobante fiscal por defecto (ítem E-5) — independiente de la condición de pago, ver condicionPagoPorDefecto.',
  })
  @IsOptional()
  @IsEnum(TipoComprobanteFiscal)
  comprobanteFiscalPorDefecto?: TipoComprobanteFiscal | null;

  @ApiProperty({
    required: false,
    enum: CondicionPago,
    description: 'Si este cliente paga de contado o a crédito por defecto — autoselecciona tipoFactura al elegirlo en Facturación/POS.',
  })
  @IsOptional()
  @IsEnum(CondicionPago)
  condicionPagoPorDefecto?: CondicionPago | null;

  @ApiProperty({
    required: false,
    default: 30,
    description: 'Crédito general con este cliente (ítem Cuentas por Pagar/Cobrar) — precarga los días de crédito al facturarle a crédito.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  plazoPagoDias?: number;
}
