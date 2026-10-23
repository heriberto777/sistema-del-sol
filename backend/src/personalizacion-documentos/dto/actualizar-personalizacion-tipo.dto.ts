import { ApiProperty } from '@nestjs/swagger';
import { QrContenido } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CAMPOS_EMISOR_CLIENTE, COLUMNAS_LINEA, TOTALES_VISIBLES } from '../personalizacion-documentos.constants';

export class ActualizarPersonalizacionTipoDto {
  @ApiProperty({ required: false, type: [String], enum: CAMPOS_EMISOR_CLIENTE })
  @IsOptional()
  @IsArray()
  @IsIn(CAMPOS_EMISOR_CLIENTE, { each: true })
  camposEmisorVisibles?: string[];

  @ApiProperty({ required: false, type: [String], enum: CAMPOS_EMISOR_CLIENTE })
  @IsOptional()
  @IsArray()
  @IsIn(CAMPOS_EMISOR_CLIENTE, { each: true })
  camposClienteVisibles?: string[];

  @ApiProperty({ required: false, type: [String], enum: COLUMNAS_LINEA })
  @IsOptional()
  @IsArray()
  @IsIn(COLUMNAS_LINEA, { each: true })
  columnasLinea?: string[];

  @ApiProperty({ required: false, type: [String], enum: TOTALES_VISIBLES })
  @IsOptional()
  @IsArray()
  @IsIn(TOTALES_VISIBLES, { each: true })
  totalesVisibles?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  textoLegal?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  qrHabilitado?: boolean;

  @ApiProperty({ required: false, enum: QrContenido })
  @IsOptional()
  @IsEnum(QrContenido)
  qrContenido?: QrContenido;

  /** URL de pago o texto libre, según `qrContenido` — ver docs de QrContenido en schema.prisma. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  qrValor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  firmaHabilitada?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firmaEtiqueta?: string;

  /** Data URI de la imagen de firma/sello, igual criterio que `Tenant.logo` — sin límite estricto de longitud. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firmaImagen?: string;

  @ApiProperty({ required: false, description: 'Si el campo de Observaciones del documento se imprime, cuando el documento lo trae lleno.' })
  @IsOptional()
  @IsBoolean()
  observacionesVisibles?: boolean;
}
