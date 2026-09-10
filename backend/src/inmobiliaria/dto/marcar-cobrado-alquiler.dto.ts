import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class MarcarCobradoAlquilerDto {
  @ApiProperty({
    required: false,
    default: false,
    description: 'Si es true, genera además una Factura real (con NCF o e-CF según la modalidad del tenant) — si es false, queda como registro interno sin comprobante.',
  })
  @IsOptional()
  @IsBoolean()
  generarFactura?: boolean;

  @ApiProperty({ required: false, default: false, description: 'Solo aplica si generarFactura es true — el alquiler suele estar exento de ITBIS' })
  @IsOptional()
  @IsBoolean()
  aplicaItbis?: boolean;
}
