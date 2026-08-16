import { Module } from '@nestjs/common';
import { EmpleadosService } from './empleados.service';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosRepository } from './empleados.repository';
import { PeriodosNominaService } from './periodos-nomina.service';
import { PeriodosNominaController } from './periodos-nomina.controller';
import { PeriodosNominaRepository } from './periodos-nomina.repository';

@Module({
  controllers: [EmpleadosController, PeriodosNominaController],
  providers: [EmpleadosService, EmpleadosRepository, PeriodosNominaService, PeriodosNominaRepository],
})
export class NominaModule {}
