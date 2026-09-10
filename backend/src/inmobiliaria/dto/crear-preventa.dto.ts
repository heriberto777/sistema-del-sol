import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CrearPreventaDto {
  @ApiProperty({ description: 'Cliente comprador — se crea un Proyecto (plugin Proyectos) a su nombre, en modo PRECIO_FIJO' })
  @IsUUID()
  clienteId: string;
}
