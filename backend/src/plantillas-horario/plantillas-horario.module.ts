import { Module } from '@nestjs/common';
import { PlantillasHorarioService } from './plantillas-horario.service';
import { PlantillasHorarioController } from './plantillas-horario.controller';
import { PlantillasHorarioRepository } from './plantillas-horario.repository';

@Module({
  controllers: [PlantillasHorarioController],
  providers: [PlantillasHorarioService, PlantillasHorarioRepository],
  exports: [PlantillasHorarioService, PlantillasHorarioRepository],
})
export class PlantillasHorarioModule {}
