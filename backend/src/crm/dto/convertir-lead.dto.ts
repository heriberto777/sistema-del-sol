import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoCliente } from '@prisma/client';

/** nombre/email/telefono se heredan del Lead — acá solo lo que un Cliente necesita y el Lead no tiene. */
export class ConvertirLeadDto {
  @IsOptional()
  @IsEnum(TipoCliente)
  tipo?: TipoCliente;

  @IsOptional()
  @IsString()
  rncCedula?: string;
}
