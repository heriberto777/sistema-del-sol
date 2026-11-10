import { ApiProperty } from '@nestjs/swagger';
import { TipoDocumentoComentario } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CrearComentarioDocumentoDto {
  @ApiProperty({ enum: TipoDocumentoComentario })
  @IsEnum(TipoDocumentoComentario)
  tipoDocumento: TipoDocumentoComentario;

  @ApiProperty()
  @IsUUID()
  documentoId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  texto: string;

  @ApiProperty({ required: false, description: 'Usuario mencionado con @ — recibe un aviso (Email + WhatsApp si tiene teléfono), salvo que se mencione a sí mismo.' })
  @IsOptional()
  @IsUUID()
  mencionadoId?: string;

  @ApiProperty({ required: false, description: 'Si se manda, el cron diario avisa a (mencionado ?? autor) cuando llegue esta fecha.' })
  @IsOptional()
  @IsDateString()
  fechaRecordatorio?: string;
}
