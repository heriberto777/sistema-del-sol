import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PlantillaDocumento } from '@prisma/client';

/** Si se omite, usa el default de PlataformaConfiguracion.plantillaDocumento — ver FacturasPlataformaService.generarPdf. Siempre tamaño carta (a diferencia del lado tenant, FacturaPlataforma no tiene FormatoImpresion). */
export class ImprimirFacturaPlataformaQueryDto {
  @ApiProperty({ enum: PlantillaDocumento, required: false })
  @IsOptional()
  @IsEnum(PlantillaDocumento)
  plantilla?: PlantillaDocumento;
}
