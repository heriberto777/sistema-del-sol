import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsUrl } from 'class-validator';
import { EVENTOS } from '../../event-bus/events';

const EVENTOS_DISPONIBLES = Object.values(EVENTOS);

export class CrearWebhookDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  url: string;

  @ApiProperty({ enum: EVENTOS_DISPONIBLES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(EVENTOS_DISPONIBLES, { each: true })
  eventos: string[];
}
