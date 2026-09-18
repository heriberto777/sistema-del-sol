import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { PlantillaDocumento } from '@prisma/client';

/** Sin `destinatario` a propósito — resuelve al Admin Total del tenant (EMAIL) o Tenant.telefono (WHATSAPP), mismo criterio que notificarFactura/notificarPorRegla. */
export class ReenviarFacturaPlataformaDto {
  @ApiProperty({ enum: ['EMAIL', 'WHATSAPP'] })
  @IsIn(['EMAIL', 'WHATSAPP'])
  canal: 'EMAIL' | 'WHATSAPP';

  @ApiProperty({ enum: PlantillaDocumento, required: false, description: 'Solo tiene efecto con canal EMAIL (adjunta el PDF).' })
  @IsOptional()
  @IsEnum(PlantillaDocumento)
  plantilla?: PlantillaDocumento;
}
