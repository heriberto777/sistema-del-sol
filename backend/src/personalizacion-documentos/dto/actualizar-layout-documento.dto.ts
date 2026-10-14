import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';

/**
 * El cuerpo de cada bloque (tipo/x/y/w/h + config propia según tipo) NO
 * se valida campo por campo acá — el motor de render
 * (`documento-pdf-layout.ts`/`resolver-personalizacion-documento.ts`,
 * `validarLayoutDocumento`) ya es defensivo ante cualquier bloque mal
 * formado (lo ignora en vez de romper la impresión), así que esta pantalla
 * es admin-only y confía en que la vino del editor de canvas propio. Igual
 * criterio que otros `Json?` libres del proyecto (ej. `AuditLog.antes`).
 */
export class ActualizarLayoutDocumentoDto {
  /** `null`/vacío = volver a usar la plantilla fija (CLASICO/ECF_OFICIAL/etc.), ver PlantillaDocumento. */
  @ApiProperty({ required: false, type: [Object] })
  @IsOptional()
  @IsArray()
  bloques?: Record<string, unknown>[];
}
