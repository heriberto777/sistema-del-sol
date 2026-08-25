import { Module } from '@nestjs/common';
import { ConfiguracionesModule } from '../configuraciones/configuraciones.module';
import { PuestosModule } from '../puestos/puestos.module';
import { PlantillasHorarioModule } from '../plantillas-horario/plantillas-horario.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { EmpleadosService } from './empleados.service';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosRepository } from './empleados.repository';
import { PeriodosNominaService } from './periodos-nomina.service';
import { PeriodosNominaController } from './periodos-nomina.controller';
import { PeriodosNominaRepository } from './periodos-nomina.repository';
import { HorariosService } from './horarios.service';
import { HorariosController } from './horarios.controller';
import { HorariosRepository } from './horarios.repository';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaRepository } from './asistencia.repository';
import { AusenciasService } from './ausencias.service';
import { AusenciasController } from './ausencias.controller';
import { AusenciasRepository } from './ausencias.repository';
import { TiposAusenciaConfigService } from './tipos-ausencia-config.service';
import { TiposAusenciaConfigController } from './tipos-ausencia-config.controller';
import { TiposAusenciaConfigRepository } from './tipos-ausencia-config.repository';

@Module({
  imports: [ConfiguracionesModule, PuestosModule, PlantillasHorarioModule, UsuariosModule],
  controllers: [
    EmpleadosController,
    PeriodosNominaController,
    HorariosController,
    AsistenciaController,
    AusenciasController,
    TiposAusenciaConfigController,
  ],
  providers: [
    EmpleadosService,
    EmpleadosRepository,
    PeriodosNominaService,
    PeriodosNominaRepository,
    HorariosService,
    HorariosRepository,
    AsistenciaService,
    AsistenciaRepository,
    AusenciasService,
    AusenciasRepository,
    TiposAusenciaConfigService,
    TiposAusenciaConfigRepository,
  ],
  // EmpleadosRepository: la usa PosModule para "vendedor de la venta" (F2)
  // sin exigir el módulo Nómina activo ni el permiso nomina.ver — ver
  // GET /pos/vendedores.
  exports: [EmpleadosRepository],
})
export class NominaModule {}
