import { ApiProperty } from '@nestjs/swagger';
import { EstadoTurnoCaja } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

export class ListarTurnosQueryDto extends ListadoQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  cajeroId?: string;

  @ApiProperty({ required: false, enum: EstadoTurnoCaja })
  @IsOptional()
  @IsEnum(EstadoTurnoCaja)
  estado?: EstadoTurnoCaja;

  @ApiProperty({ required: false, description: 'Filtra por abiertoEn >= desde' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiProperty({ required: false, description: 'Filtra por abiertoEn <= hasta' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
