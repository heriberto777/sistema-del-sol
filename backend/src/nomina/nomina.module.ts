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
  // EmpleadosRepository: la usa PosModule para "vendedor de la venta" (F2)
  // sin exigir el módulo Nómina activo ni el permiso nomina.ver — ver
  // GET /pos/vendedores.
  exports: [EmpleadosRepository],
})
export class NominaModule {}
