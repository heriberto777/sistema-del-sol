import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promises as dns } from 'dns';
import { TenantDominiosRepository } from './tenant-dominios.repository';
import { NpmClientService } from '../plataforma-config/npm/npm-client.service';
import { PlataformaConfigRepository } from '../plataforma-config/plataforma-config.repository';

// Un dominio real tiene al menos una etiqueta + un TLD (ej. "shopy-me.com")
// — no valida más que el formato básico, la verificación real es el DNS.
const REGEX_DOMINIO = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Orquesta la activación de un dominio propio para la tienda de un tenant
 * (ítem "dominio propio de tenant", ver ARCHITECTURE.md): valida el
 * dominio, verifica su DNS contra `npmPublicHost` (el destino PÚBLICO al
 * que el tenant apunta — distinto de `npmForwardHost`, el destino interno
 * al que NPM reenvía) y, si apunta bien, dispara `NpmClientService` para
 * emitir el certificado + crear el Proxy Host. Gestionado solo por el
 * super admin (`platform.tenants.dominios.gestionar`) — nunca self-service
 * del tenant, por eso no hay verificación de propiedad por TXT record acá
 * (decisión explícita, ver el plan de esta feature).
 */
@Injectable()
export class TenantDominiosService {
  private readonly logger = new Logger(TenantDominiosService.name);

  constructor(
    private readonly repo: TenantDominiosRepository,
    private readonly npm: NpmClientService,
    private readonly plataformaConfigRepo: PlataformaConfigRepository,
  ) {}

  listar(tenantId: string) {
    return this.repo.listarPorTenant(tenantId);
  }

  async agregar(tenantId: string, dominioCrudo: string) {
    const dominio = dominioCrudo
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');

    if (!REGEX_DOMINIO.test(dominio)) {
      throw new BadRequestException('Dominio inválido — usá el formato "midominio.com" o "www.midominio.com", sin protocolo ni ruta');
    }
    if (dominio.endsWith('.ciguadev.com')) {
      throw new BadRequestException('Los subdominios de ciguadev.com ya se asignan automáticamente al crear el tenant — no hace falta agregarlos acá');
    }
    if (await this.repo.buscarPorDominio(dominio)) {
      throw new ConflictException('Ese dominio ya está asignado a un tenant');
    }

    return this.repo.crear(tenantId, dominio);
  }

  /**
   * DNS → NPM, en ese orden — un certificado HTTP-01 falla si el dominio
   * todavía no resuelve al servidor, así que no tiene sentido intentar
   * NPM sin confirmar el DNS primero.
   */
  async verificarYActivar(id: string) {
    const registro = await this.repo.buscarPorId(id);
    if (!registro) throw new NotFoundException('Dominio no encontrado');

    const config = await this.plataformaConfigRepo.obtenerOCrear();
    if (!config.npmPublicHost) {
      return this.repo.actualizarEstado(id, {
        estado: 'ERROR',
        mensajeError: 'Falta configurar el "Destino público" de Nginx Proxy Manager en /plataforma/configuración',
      });
    }

    await this.repo.actualizarEstado(id, { estado: 'VERIFICANDO' });

    const apunta = await this.dnsApuntaBien(registro.dominio, config.npmPublicHost);
    if (!apunta) {
      return this.repo.actualizarEstado(id, {
        estado: 'ERROR',
        mensajeError: `El DNS de ${registro.dominio} todavía no apunta a ${config.npmPublicHost} — verificá el CNAME/A record en el proveedor del tenant y volvé a intentar (la propagación puede tardar)`,
      });
    }

    try {
      const certificadoId = await this.npm.emitirCertificado([registro.dominio]);
      const proxyHostId = await this.npm.crearProxyHost([registro.dominio], certificadoId);
      return this.repo.actualizarEstado(id, {
        estado: 'ACTIVO',
        mensajeError: null,
        npmProxyHostId: proxyHostId,
        npmCertificadoId: certificadoId,
        activadoEn: new Date(),
      });
    } catch (error) {
      this.logger.error(`Fallo al activar el dominio ${registro.dominio}`, error as Error);
      return this.repo.actualizarEstado(id, { estado: 'ERROR', mensajeError: (error as Error).message });
    }
  }

  async eliminar(id: string) {
    const registro = await this.repo.buscarPorId(id);
    if (!registro) throw new NotFoundException('Dominio no encontrado');

    if (registro.npmProxyHostId) {
      try {
        await this.npm.eliminarProxyHost(registro.npmProxyHostId);
      } catch (error) {
        // Best-effort — un Proxy Host huérfano en NPM no es tan grave como
        // dejar al super admin sin poder borrar el registro de este lado.
        this.logger.warn(`No se pudo borrar el Proxy Host ${registro.npmProxyHostId} en NPM: ${(error as Error).message}`);
      }
    }
    await this.repo.eliminar(id);
  }

  /** `npmPublicHost` puede ser una IP (A record) o un hostname (CNAME) — se compara contra el tipo de registro que corresponda. */
  private async dnsApuntaBien(dominio: string, publicHost: string): Promise<boolean> {
    const esIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(publicHost);
    try {
      if (esIp) {
        const ips = await dns.resolve4(dominio);
        return ips.includes(publicHost);
      }
      const cnames = await dns.resolveCname(dominio);
      return cnames.some((c) => c.toLowerCase().replace(/\.$/, '') === publicHost.toLowerCase().replace(/\.$/, ''));
    } catch {
      return false;
    }
  }
}
