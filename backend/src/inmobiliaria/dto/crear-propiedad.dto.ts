import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EstadoPropiedad, OperacionPropiedad, TipoPropiedad } from '@prisma/client';

/** Mismo criterio de validación que ImagenProductoDto — data URI, tope de peso. */
export class ImagenPropiedadDto {
  @ApiProperty({ description: 'Data URI completa (data:image/...;base64,...)' })
  @IsString()
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, { message: 'imagen debe ser una data URI de imagen (jpeg/png/webp)' })
  @MaxLength(2_000_000, { message: 'La imagen es demasiado pesada — comprimila antes de subirla' })
  imagen: string;
}

export class CrearPropiedadDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  codigo: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  titulo: string;

  @ApiProperty({ enum: TipoPropiedad })
  @IsEnum(TipoPropiedad)
  tipo: TipoPropiedad;

  @ApiProperty({ enum: OperacionPropiedad })
  @IsEnum(OperacionPropiedad)
  operacion: OperacionPropiedad;

  @ApiProperty({ enum: EstadoPropiedad, required: false, default: EstadoPropiedad.ACTIVA })
  @IsOptional()
  @IsEnum(EstadoPropiedad)
  estado?: EstadoPropiedad;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  precio: number;

  @ApiProperty({ required: false, default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  moneda?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  ubicacion: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  habitaciones?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  banos?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  parqueos?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  metrosConstruccion?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  metrosTerreno?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  descripcion?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  amenidades?: string[];

  @ApiProperty({ required: false, description: 'Empleado (agente) asignado' })
  @IsOptional()
  @IsUUID()
  agenteId?: string | null;

  @ApiProperty({ required: false, description: 'Cliente dueño del inmueble — solo si la agencia lo administra en alquiler (Modelo 2)' })
  @IsOptional()
  @IsUUID()
  propietarioId?: string | null;

  @ApiProperty({ required: false, type: [ImagenPropiedadDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ImagenPropiedadDto)
  imagenes?: ImagenPropiedadDto[];
}
