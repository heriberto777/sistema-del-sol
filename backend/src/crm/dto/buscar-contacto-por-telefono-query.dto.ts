import { IsNotEmpty, IsString } from 'class-validator';

export class BuscarContactoPorTelefonoQueryDto {
  @IsString()
  @IsNotEmpty()
  telefono: string;
}
