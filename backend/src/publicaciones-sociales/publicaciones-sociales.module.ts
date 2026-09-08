import { Module } from '@nestjs/common';
import { PublicacionesSocialesService } from './publicaciones-sociales.service';
import { PublicacionesSocialesController } from './publicaciones-sociales.controller';
import { PublicacionesSocialesRepository } from './publicaciones-sociales.repository';
import { PublicacionSocialImagenPublicaController } from './publicacion-social-imagen-publica.controller';
import { PublicacionSocialImagenPublicaService } from './publicacion-social-imagen-publica.service';
import { WhatsappConfigModule } from '../whatsapp-config/whatsapp-config.module';
import { IaModule } from '../ia/ia.module';

/**
 * Plugin de Publicaciones Sociales (ver
 * plugins/publicaciones-sociales/README.md — Fase 1: imagen desde
 * plantillas; Fase 2: fondo generado por IA, `IaModule` es de ahí).
 * Gateado por módulo (`@RequiereModulo('publicacionessociales')`) igual
 * que Proyectos: el tenant lo recibe vía su Plan o un
 * `TenantModuloOverride` puntual desde /plataforma/tenants, nunca lo
 * activa el propio tenant.
 */
@Module({
  imports: [WhatsappConfigModule, IaModule],
  controllers: [PublicacionesSocialesController, PublicacionSocialImagenPublicaController],
  providers: [PublicacionesSocialesService, PublicacionesSocialesRepository, PublicacionSocialImagenPublicaService],
})
export class PublicacionesSocialesModule {}
