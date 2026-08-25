import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { RedisThrottlerStorage } from './redis/redis-throttler-storage.service';
import { PrismaModule } from './prisma/prisma.module';
import { EventBusModule } from './event-bus/event-bus.module';
import { PluginsModule } from './plugins/plugins.module';
import { AuthModule } from './auth/auth.module';
import { FacturacionModule } from './facturacion/facturacion.module';
import { InventarioModule } from './inventario/inventario.module';
import { ProductosModule } from './productos/productos.module';
import { PreciosModule } from './precios/precios.module';
import { ComprasModule } from './compras/compras.module';
import { ClientesModule } from './clientes/clientes.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PlanesModule } from './planes/planes.module';
import { PlatformAdminsModule } from './platform-admins/platform-admins.module';
import { FacturacionPlataformaModule } from './facturacion-plataforma/facturacion-plataforma.module';
import { PlataformaConfigModule } from './plataforma-config/plataforma-config.module';
import { ConfiguracionesModule } from './configuraciones/configuraciones.module';
import { PlatformAuthModule } from './platform-auth/platform-auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { PlatformAuditLogModule } from './platform-audit-log/platform-audit-log.module';
import { NcfModule } from './ncf/ncf.module';
import { CorrelativosModule } from './correlativos/correlativos.module';
import { ReportesModule } from './reportes/reportes.module';
import { ReportesFiscalesModule } from './reportes-fiscales/reportes-fiscales.module';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module';
import { RemisionesModule } from './remisiones/remisiones.module';
import { RecordatoriosModule } from './recordatorios/recordatorios.module';
import { ContabilidadModule } from './contabilidad/contabilidad.module';
import { NominaModule } from './nomina/nomina.module';
import { FeriadosModule } from './feriados/feriados.module';
import { PuestosModule } from './puestos/puestos.module';
import { LeyesFiscalesModule } from './leyes-fiscales/leyes-fiscales.module';
import { PlantillasHorarioModule } from './plantillas-horario/plantillas-horario.module';
import { PosModule } from './pos/pos.module';
import { IaModule } from './ia/ia.module';
import { BancosModule } from './bancos/bancos.module';
import { GastosMenoresModule } from './gastos-menores/gastos-menores.module';
import { FormasPagoModule } from './formas-pago/formas-pago.module';
import { CategoriasModule } from './categorias/categorias.module';
import { CategoriasClienteModule } from './categorias-cliente/categorias-cliente.module';
import { ListasPrecioModule } from './listas-precio/listas-precio.module';
import { AtributosModule } from './atributos/atributos.module';
import { VariantesModule } from './variantes/variantes.module';
import { OfertasModule } from './ofertas/ofertas.module';
import { ComisionesModule } from './comisiones/comisiones.module';
import { LealtadModule } from './lealtad/lealtad.module';
import { CajasModule } from './cajas/cajas.module';
import { TasasCambioModule } from './tasas-cambio/tasas-cambio.module';
import { BonosModule } from './bonos/bonos.module';
import { SucursalesModule } from './sucursales/sucursales.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { ModuloActivoGuard } from './common/guards/modulo-activo.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    ScheduleModule.forRoot(),
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    PrismaModule,
    EventBusModule,
    PluginsModule,
    AuthModule,
    FacturacionModule,
    SucursalesModule,
    InventarioModule,
    ProductosModule,
    PreciosModule,
    ComprasModule,
    ClientesModule,
    ProveedoresModule,
    NotificacionesModule,
    WebhooksModule,
    UsuariosModule,
    PlanesModule,
    PlatformAdminsModule,
    FacturacionPlataformaModule,
    PlataformaConfigModule,
    ConfiguracionesModule,
    PlatformAuthModule,
    TenantsModule,
    PlatformAuditLogModule,
    NcfModule,
    CorrelativosModule,
    ReportesModule,
    ReportesFiscalesModule,
    CotizacionesModule,
    RemisionesModule,
    RecordatoriosModule,
    ContabilidadModule,
    NominaModule,
    FeriadosModule,
    PuestosModule,
    LeyesFiscalesModule,
    PlantillasHorarioModule,
    PosModule,
    IaModule,
    BancosModule,
    FormasPagoModule,
    CategoriasModule,
    CategoriasClienteModule,
    ListasPrecioModule,
    AtributosModule,
    VariantesModule,
    GastosMenoresModule,
    OfertasModule,
    ComisionesModule,
    LealtadModule,
    CajasModule,
    TasasCambioModule,
    BonosModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ModuloActivoGuard },
    // PlatformPermissionsGuard NO va acá (a diferencia de los de arriba):
    // Nest ejecuta los guards globales ANTES que los de @UseGuards() a
    // nivel de controller, y PlatformAuthGuard (el que realmente puebla
    // request.user para rutas de plataforma) es de controller, no global
    // — si PlatformPermissionsGuard fuera global correría primero y
    // request.user siempre estaría vacío. Por eso se aplica junto a
    // PlatformAuthGuard en cada controller de plataforma:
    // @UseGuards(PlatformAuthGuard, PlatformPermissionsGuard).
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
