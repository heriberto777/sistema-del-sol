import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CrearPublicacionSocialDto {
  @ApiProperty()
  @IsUUID()
  productoId: string;

  @ApiProperty()
  @IsUUID()
  plantillaId: string;
}
