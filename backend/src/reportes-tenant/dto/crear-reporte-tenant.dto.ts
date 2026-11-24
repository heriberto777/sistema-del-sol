import { ApiProperty } from '@nestjs/swagger';
import { CategoriaReporteTenant } from '@prisma/client';
import { IsEnum, IsNotEmptyObject, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Crea el ticket y, en la misma operación, su primer mensaje (el cuerpo
 * del reporte) — ver `ReportesTenantService.crear`. `cuerpo` es un
 * documento de Tiptap (JSON), validado contra una lista blanca de
 * nodos/marcas antes de guardar (ver `validar-documento-tiptap.ts`).
 */
export class CrearReporteTenantDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  asunto: string;

  @ApiProperty({ enum: CategoriaReporteTenant })
  @IsEnum(CategoriaReporteTenant)
  categoria: CategoriaReporteTenant;

  @ApiProperty({ description: 'Documento de Tiptap (JSON) — el cuerpo del primer mensaje del hilo.' })
  @IsObject()
  @IsNotEmptyObject()
  cuerpo: object;

  @ApiProperty({ required: false, description: 'Adjunto en base64 (sin el prefijo data:...;base64,) — máx. ~5MB.' })
  @IsOptional()
  @IsString()
  @MaxLength(7_000_000)
  adjuntoBase64?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  adjuntoNombre?: string;
}
