import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/** Reemplazo total del orden — mismo criterio que ImagenProducto/FacturaRecargo: se manda la lista completa de ids en el orden deseado, `orden` se setea por índice. */
export class ReordenarSeccionesTiendaDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];
}
