import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { PluginManifest } from './plugin-manifest.interface';

/**
 * Descubre los plugins instalados manualmente (git/deploy) leyendo
 * plugins/<nombre>/plugin.json en la raíz del monorepo. La activación
 * NestJS de las rutas de cada plugin se hace importando su módulo a mano
 * en AppModule; este loader solo informa qué manifiestos hay disponibles
 * y sirve de fuente de verdad para validar tenant_plugins.pluginKey.
 */
@Injectable()
export class PluginLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PluginLoaderService.name);
  private manifests: PluginManifest[] = [];

  onModuleInit() {
    const pluginsDir = join(process.cwd(), '..', 'plugins');
    if (!existsSync(pluginsDir)) {
      this.logger.warn(`No existe el directorio de plugins: ${pluginsDir}`);
      return;
    }

    this.manifests = readdirSync(pluginsDir, { withFileTypes: true })
      .filter((entrada) => entrada.isDirectory())
      .map((entrada) => join(pluginsDir, entrada.name, 'plugin.json'))
      .filter((manifestPath) => existsSync(manifestPath))
      .map((manifestPath) => JSON.parse(readFileSync(manifestPath, 'utf-8')) as PluginManifest);

    this.logger.log(
      `Plugins descubiertos: ${this.manifests.map((m) => `${m.key}@${m.version}`).join(', ') || 'ninguno'}`,
    );
  }

  getManifests(): PluginManifest[] {
    return this.manifests;
  }
}
