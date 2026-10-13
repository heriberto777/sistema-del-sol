import { IsUUID } from 'class-validator';

export class CambiarEtapaOportunidadDto {
  @IsUUID()
  etapaId: string;
}
