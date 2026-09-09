import { Injectable } from '@nestjs/common';
import { ConfiguracionesRepository } from './configuraciones.repository';
import { PrismaService } from '../prisma/prisma.service';

const CLAVE_DOCUMENTO_LOGO = 'DOCUMENTO_LOGO';

@Injectable()
export class ConfiguracionesService {
  constructor(
    private readonly configuracionesRepository: ConfiguracionesRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * `DOCUMENTO_LOGO` ya no vive en `Configuracion` — se promovió a
   * `Tenant.logo` (ver `resolver-personalizacion-documento.ts`) para
   * que Plataforma también pueda asignarlo desde `/plataforma/tenants`.
   * El frontend (`PersonalizacionDocumentosPanel.tsx`) sigue pegándole
   * a este mismo endpoint genérico sin enterarse — acá se intercepta
   * esa clave puntual y se arma un row sintético para no romper el
   * contrato `{clave, valor}[]` que ya consume.
   */
  async listar(tenantId: string) {
    const [configuraciones, tenant] = await Promise.all([
      this.configuracionesRepository.listar(),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { logo: true } }),
    ]);
    return [...configuraciones, { clave: CLAVE_DOCUMENTO_LOGO, valor: tenant?.logo ?? '' }];
  }

  actualizar(clave: string, valor: string, tenantId: string) {
    if (clave === CLAVE_DOCUMENTO_LOGO) {
      return this.prisma.tenant.update({ where: { id: tenantId }, data: { logo: valor || null } });
    }
    return this.configuracionesRepository.actualizar(clave, valor, tenantId);
  }

  /** Único punto donde una Configuracion se lee programáticamente (ver PosService.cerrarTurno) — cae al default si el tenant no la tiene sembrada. */
  async buscarValor(clave: string, tenantId: string, valorDefault: string): Promise<string> {
    const fila = await this.configuracionesRepository.buscarPorClave(clave, tenantId);
    return fila?.valor ?? valorDefault;
  }
}
