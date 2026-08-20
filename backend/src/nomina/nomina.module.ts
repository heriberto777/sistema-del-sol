import { Module } from '@nestjs/common';
import { EmpleadosService } from './empleados.service';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosRepository } from './empleados.repository';
import { PeriodosNominaService } from './periodos-nomina.service';
import { PeriodosNominaController } from './periodos-nomina.controller';
import { PeriodosNominaRepository } from './periodos-nomina.repository';
import { HorariosService } from './horarios.service';
import { HorariosController } from './horarios.controller';
import { HorariosRepository } from './horarios.repository';

@Module({
  controllers: [EmpleadosController, PeriodosNominaController, HorariosController],
  providers: [EmpleadosService, EmpleadosRepository, PeriodosNominaService, PeriodosNominaRepository, HorariosService, HorariosRepository],
  // EmpleadosRepository: la usa PosModule para "vendedor de la venta" (F2)
  // sin exigir el módulo Nómina activo ni el permiso nomina.ver — ver
  // GET /pos/vendedores.
  exports: [EmpleadosRepository],
})
export class NominaModule {}
