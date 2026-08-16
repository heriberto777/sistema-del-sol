import { Injectable } from '@nestjs/common';
import { TenantPluginsRepository } from './tenant-plugins.repository';
import { PluginLoaderService } from '../plugins/plugin-loader.service';

@Injectable()
export class TenantPluginsService {
  constructor(
    private readonly tenantPluginsRepository: TenantPluginsRepository,
    private readonly pluginLoaderService: PluginLoaderService,
  ) {}

  async listar() {
    const [manifests, instalados] = await Promise.all([
      this.pluginLoaderService.getManifests(),
      this.tenantPluginsRepository.listarInstalados(),
    ]);

    return manifests.map((manifest) => ({
      ...manifest,
      activo: instalados.find((i) => i.pluginKey === manifest.key)?.activo ?? false,
    }));
  }

  activar(pluginKey: string, tenantId: string) {
    return this.tenantPluginsRepository.setActivo(pluginKey, true, tenantId);
  }

  desactivar(pluginKey: string, tenantId: string) {
    return this.tenantPluginsRepository.setActivo(pluginKey, false, tenantId);
  }
}
