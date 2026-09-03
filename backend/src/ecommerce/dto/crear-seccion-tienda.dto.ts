import { ApiProperty } from '@nestjs/swagger';
import { TipoSeccionTienda } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

export class CrearSeccionTiendaDto {
  @ApiProperty({ enum: TipoSeccionTienda })
  @IsEnum(TipoSeccionTienda)
  tipo: TipoSeccionTienda;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  titulo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subtitulo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ctaTexto?: string;

  @ApiProperty({ required: false, description: 'Solo tipo=CATEGORIA — decorativa, la tarjeta ya linkea a categoriaId' })
  @IsOptional()
  @IsString()
  imagen?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @ApiProperty({ required: false, description: 'Obligatorio si tipo=CATEGORIA' })
  @ValidateIf((o) => o.tipo === 'CATEGORIA')
  @IsUUID()
  categoriaId?: string;

  @ApiProperty({ required: false, type: [String], description: 'Obligatorio si tipo=PRODUCTOS o BANNER — al menos 1 producto elegido a mano' })
  @ValidateIf((o) => o.tipo === 'PRODUCTOS' || o.tipo === 'BANNER')
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  productoIds?: string[];

  @ApiProperty({ required: false, type: [String], description: 'Obligatorio si tipo=MINIGRID — entre 2 y 4 categorías' })
  @ValidateIf((o) => o.tipo === 'MINIGRID')
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsUUID('4', { each: true })
  categoriaIds?: string[];
}
