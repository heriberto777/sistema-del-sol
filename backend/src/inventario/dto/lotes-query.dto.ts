import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class LotesQueryDto {
  @ApiProperty()
  @IsUUID()
  varianteId: string;

  @ApiProperty()
  @IsUUID()
  bodegaId: string;
}
