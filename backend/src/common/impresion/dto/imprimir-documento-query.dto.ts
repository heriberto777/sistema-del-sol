import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FormatoImpresion, PlantillaDocumento } from '@prisma/client';

/**
 * Si se omiten, el backend resuelve el valor efectivo de cada uno (override
 * de Bodega > default del tenant > CARTA/CLASICO) — ver
 * resolverFormatoImpresion/resolverPlantillaDocumento. Son dos ejes
 * independientes: `formato` es tamaño de papel, `plantilla` es diseño
 * visual (sin efecto si `formato` termina siendo TERMICA_80MM/58MM).
 */
export class ImprimirDocumentoQueryDto {
  @ApiProperty({ enum: FormatoImpresion, required: false })
  @IsOptional()
  @IsEnum(FormatoImpresion)
  formato?: FormatoImpresion;

  @ApiProperty({ enum: PlantillaDocumento, required: false })
  @IsOptional()
  @IsEnum(PlantillaDocumento)
  plantilla?: PlantillaDocumento;
}
