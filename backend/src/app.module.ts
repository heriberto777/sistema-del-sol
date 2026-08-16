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
import { TenantPluginsModule } from './tenant-plugins/tenant-plugins.module';
import { ConfiguracionesModule } from './configuraciones/configuraciones.module';
import { PlatformAuthModule } from './platform-auth/platform-auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { PlatformAuditLogModule } from './platform-audit-log/platform-audit-log.module';
import { NcfModule } from './ncf/ncf.module';
import { ReportesModule } from './reportes/reportes.module';
import { ReportesFiscalesModule } from './reportes-fiscales/reportes-fiscales.module';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module';
import { RemisionesModule } from './remisiones/remisiones.module';
import { RecordatoriosModule } from './recordatorios/recordatorios.module';
import { ContabilidadModule } from './contabilidad/contabilidad.module';
import { NominaModule } from './nomina/nomina.module';
import { PosModule } from './pos/pos.module';
import { IaModule } from './ia/ia.module';
import { BancosModule } from './bancos/bancos.module';
import { GastosMenoresModule } from './gastos-menores/gastos-menores.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
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
    InventarioModule,
    ProductosModule,
    PreciosModule,
    ComprasModule,
    ClientesModule,
    ProveedoresModule,
    NotificacionesModule,
    WebhooksModule,
    UsuariosModule,
    TenantPluginsModule,
    ConfiguracionesModule,
    PlatformAuthModule,
    TenantsModule,
    PlatformAuditLogModule,
    NcfModule,
    ReportesModule,
    ReportesFiscalesModule,
    CotizacionesModule,
    RemisionesModule,
    RecordatoriosModule,
    ContabilidadModule,
    NominaModule,
    PosModule,
    IaModule,
    BancosModule,
    GastosMenoresModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
