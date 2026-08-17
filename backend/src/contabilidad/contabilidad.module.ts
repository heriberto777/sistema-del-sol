import { Module } from '@nestjs/common';
import { CuentasContablesService } from './cuentas-contables.service';
import { CuentasContablesController } from './cuentas-contables.controller';
import { CuentasContablesRepository } from './cuentas-contables.repository';
import { AsientosContablesService } from './asientos-contables.service';
import { AsientosContablesController } from './asientos-contables.controller';
import { AsientosContablesRepository } from './asientos-contables.repository';
import { EstadosFinancierosService } from './estados-financieros.service';
import { EstadosFinancierosController } from './estados-financieros.controller';
import { ContabilidadEventosService } from './contabilidad-eventos.service';
import { CierrePeriodoService } from './cierre-periodo.service';
import { CierrePeriodoController } from './cierre-periodo.controller';
import { CierrePeriodoRepository } from './cierre-periodo.repository';

@Module({
  controllers: [CuentasContablesController, AsientosContablesController, EstadosFinancierosController, CierrePeriodoController],
  providers: [
    CuentasContablesService,
    CuentasContablesRepository,
    AsientosContablesService,
    AsientosContablesRepository,
    EstadosFinancierosService,
    ContabilidadEventosService,
    CierrePeriodoService,
    CierrePeriodoRepository,
  ],
  exports: [CuentasContablesService, CierrePeriodoService],
})
export class ContabilidadModule {}
