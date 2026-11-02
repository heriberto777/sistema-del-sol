import { Module } from '@nestjs/common';
import { FacturasProveedorService } from './facturas-proveedor.service';
import { FacturasProveedorController } from './facturas-proveedor.controller';
import { FacturasProveedorRepository } from './facturas-proveedor.repository';
import { CuentasPorPagarModule } from '../cuentas-por-pagar/cuentas-por-pagar.module';
import { ProveedoresModule } from '../proveedores/proveedores.module';
import { TerminosPagoModule } from '../terminos-pago/terminos-pago.module';
import { PagosModule } from '../pagos/pagos.module';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';

@Module({
  imports: [CuentasPorPagarModule, ProveedoresModule, TerminosPagoModule, PagosModule, ContabilidadModule],
  controllers: [FacturasProveedorController],
  providers: [FacturasProveedorService, FacturasProveedorRepository],
  exports: [FacturasProveedorService],
})
export class FacturasProveedorModule {}
