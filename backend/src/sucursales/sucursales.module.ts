import { Module } from '@nestjs/common';
import { SucursalesService } from './sucursales.service';
import { SucursalesController } from './sucursales.controller';
import { SucursalesRepository } from './sucursales.repository';

@Module({
  controllers: [SucursalesController],
  providers: [SucursalesService, SucursalesRepository],
  // SucursalesRepository: la usa InventarioModule para validar que el
  // sucursalId de una Bodega nueva pertenezca al tenant (mismo patrón
  // IDOR-safe que EmpleadosRepository/HorariosRepository en Nómina).
  exports: [SucursalesRepository],
})
export class SucursalesModule {}
