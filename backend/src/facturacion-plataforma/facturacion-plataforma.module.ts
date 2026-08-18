import { Module } from '@nestjs/common';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { SuscripcionController } from './suscripcion.controller';
import { SuscripcionesService } from './suscripciones.service';
import { SuscripcionesRepository } from './suscripciones.repository';
import { FacturasPlataformaController } from './facturas-plataforma.controller';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { PagosPlataformaService } from './pagos-plataforma.service';
import { PagosPlataformaRepository } from './pagos-plataforma.repository';
import { FacturasPlataformaCronService } from './facturas-plataforma-cron.service';
import { PagoPublicoController } from './pago-publico.controller';
import { PasarelaPagoService } from './pasarela/pasarela-pago.service';
import { StripeAdapter } from './pasarela/stripe.adapter';
import { AzulAdapter } from './pasarela/azul.adapter';
import { CardNetAdapter } from './pasarela/cardnet.adapter';

@Module({
  imports: [NotificacionesModule],
  controllers: [SuscripcionController, FacturasPlataformaController, PagoPublicoController],
  providers: [
    SuscripcionesService,
    SuscripcionesRepository,
    FacturasPlataformaService,
    FacturasPlataformaRepository,
    PagosPlataformaService,
    PagosPlataformaRepository,
    FacturasPlataformaCronService,
    PasarelaPagoService,
    StripeAdapter,
    AzulAdapter,
    CardNetAdapter,
  ],
})
export class FacturacionPlataformaModule {}
