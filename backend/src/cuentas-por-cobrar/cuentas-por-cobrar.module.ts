import { Module } from '@nestjs/common';
import { CuentasPorCobrarController } from './cuentas-por-cobrar.controller';
import { CuentasPorCobrarService } from './cuentas-por-cobrar.service';
import { CuentasPorCobrarRepository } from './cuentas-por-cobrar.repository';

@Module({
  controllers: [CuentasPorCobrarController],
  providers: [CuentasPorCobrarService, CuentasPorCobrarRepository],
})
export class CuentasPorCobrarModule {}
