import { Module } from '@nestjs/common';
import { CuentasPorPagarController } from './cuentas-por-pagar.controller';
import { CuentasPorPagarService } from './cuentas-por-pagar.service';
import { CuentasPorPagarRepository } from './cuentas-por-pagar.repository';

@Module({
  controllers: [CuentasPorPagarController],
  providers: [CuentasPorPagarService, CuentasPorPagarRepository],
})
export class CuentasPorPagarModule {}
