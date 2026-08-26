import { Module } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { FacturacionController } from './facturacion.controller';
import { FacturacionRepository } from './facturacion.repository';
import { InventarioModule } from '../inventario/inventario.module';
import { PagosModule } from '../pagos/pagos.module';
import { ClientesModule } from '../clientes/clientes.module';
import { VariantesModule } from '../variantes/variantes.module';
import { OfertasModule } from '../ofertas/ofertas.module';
import { BonosModule } from '../bonos/bonos.module';
import { LealtadModule } from '../lealtad/lealtad.module';
import { AuthModule } from '../auth/auth.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { AutorizacionesModule } from '../autorizaciones/autorizaciones.module';
import { TasasCambioModule } from '../tasas-cambio/tasas-cambio.module';
import { ConfiguracionesModule } from '../configuraciones/configuraciones.module';

@Module({
  // AuthModule: FacturacionService llama a authService.verificarPin() en
  // anular() (Fase 9). El acceso por sucursal se valida vía
  // InventarioService.validarAccesoBodega (ya importado abajo), sin
  // necesitar SucursalesModule acá directamente. NotificacionesModule:
  // enviarRecibo() (ítem F-4) reusa NotificacionesService.enviar().
  // AutorizacionesModule: segunda capa de autorización (ítem D-1).
  // LealtadModule: canje de puntos como forma de pago (ítem A-3).
  // TasasCambioModule: presentación en moneda extranjera (ítem C-2).
  imports: [
    InventarioModule,
    PagosModule,
    ClientesModule,
    VariantesModule,
    OfertasModule,
    BonosModule,
    LealtadModule,
    AuthModule,
    NotificacionesModule,
    AutorizacionesModule,
    TasasCambioModule,
    ConfiguracionesModule,
  ],
  controllers: [FacturacionController],
  providers: [FacturacionService, FacturacionRepository],
  exports: [FacturacionService],
})
export class FacturacionModule {}
