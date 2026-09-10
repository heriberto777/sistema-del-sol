import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CrearContratoPropiedadDto {
  @ApiProperty({ description: 'Cliente comprador/inquilino, ya cargado en Contactos' })
  @IsUUID()
  clienteId: string;

  @ApiProperty({ description: 'Monto acordado (venta: precio total; alquiler: monto pactado)' })
  @IsNumber()
  @Min(0)
  monto: number;

  @ApiProperty({ required: false, default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  moneda?: string;

  @ApiProperty({ required: false, description: 'Empleado que gestionó el cierre — por defecto el agente ya asignado a la propiedad' })
  @IsOptional()
  @IsUUID()
  agenteId?: string;

  @ApiProperty({ required: false, description: '% sobre el monto para calcular la comisión del agente — sin esto, la comisión queda en 0' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeComision?: number;

  @ApiProperty({ required: false, description: 'Fecha de cierre — por defecto, ahora' })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;
}
