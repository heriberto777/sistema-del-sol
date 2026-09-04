import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PlataformaConfigRepository } from '../plataforma-config.repository';
import { descifrar } from '../../common/utils/encriptado.util';

interface CredencialesNpm {
  baseUrl: string;
  usuario: string;
  password: string;
  forwardHost: string;
  forwardPort: number;
}

/**
 * `fetch` nativo contra la REST API de Nginx Proxy Manager (puerto 81, la
 * misma que usa su propia UI) — mismo criterio que `StripeAdapter`/
 * `IaClientService`: sin SDK oficial (NPM no publica uno), degrada con un
 * error claro si no está configurado en vez de fallar más adelante con un
 * error críptico. Usada por `TenantDominiosService` para automatizar el
 * Proxy Host + certificado de un dominio propio de tenant (ver
 * ARCHITECTURE.md, ítem "dominio propio de tenant").
 */
@Injectable()
export class NpmClientService {
  private readonly logger = new Logger(NpmClientService.name);
  private tokenCache: { valor: string; expiraEn: number } | null = null;

  constructor(private readonly configRepo: PlataformaConfigRepository) {}

  private async obtenerCredenciales(): Promise<CredencialesNpm> {
    const config = await this.configRepo.obtenerOCrear();
    if (!config.npmBaseUrl || !config.npmUsuario || !config.npmPasswordCifrado || !config.npmForwardHost || !config.npmForwardPort) {
      throw new ServiceUnavailableException(
        'Dominio propio no disponible todavía — falta configurar Nginx Proxy Manager en /plataforma/configuración',
      );
    }
    return {
      baseUrl: config.npmBaseUrl.replace(/\/$/, ''),
      usuario: config.npmUsuario,
      password: descifrar(config.npmPasswordCifrado),
      forwardHost: config.npmForwardHost,
      forwardPort: config.npmForwardPort,
    };
  }

  /** JWT de NPM cacheado en memoria — se re-autentica solo cuando expiró (o está por expirar). */
  private async token(): Promise<{ valor: string; baseUrl: string; forwardHost: string; forwardPort: number }> {
    const credenciales = await this.obtenerCredenciales();
    if (this.tokenCache && this.tokenCache.expiraEn > Date.now() + 60_000) {
      return { valor: this.tokenCache.valor, baseUrl: credenciales.baseUrl, forwardHost: credenciales.forwardHost, forwardPort: credenciales.forwardPort };
    }

    let respuesta: Response;
    try {
      respuesta = await fetch(`${credenciales.baseUrl}/api/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: credenciales.usuario, secret: credenciales.password }),
      });
    } catch (error) {
      this.logger.error('Fallo al contactar la API de Nginx Proxy Manager', error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Nginx Proxy Manager — revisá la URL configurada');
    }
    if (!respuesta.ok) {
      throw new ServiceUnavailableException('Nginx Proxy Manager rechazó las credenciales configuradas');
    }
    const cuerpo = (await respuesta.json()) as { token: string; expires: string };
    this.tokenCache = { valor: cuerpo.token, expiraEn: new Date(cuerpo.expires).getTime() };
    return { valor: cuerpo.token, baseUrl: credenciales.baseUrl, forwardHost: credenciales.forwardHost, forwardPort: credenciales.forwardPort };
  }

  private async peticion<T>(metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<T> {
    const { valor: token, baseUrl } = await this.token();
    let respuesta: Response;
    try {
      respuesta = await fetch(`${baseUrl}${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      });
    } catch (error) {
      this.logger.error(`Fallo al llamar ${metodo} ${ruta} en NPM`, error as Error);
      throw new ServiceUnavailableException('No se pudo contactar a Nginx Proxy Manager');
    }
    const texto = await respuesta.text();
    if (!respuesta.ok) {
      this.logger.error(`NPM respondió ${respuesta.status} en ${metodo} ${ruta}: ${texto}`);
      let mensaje = texto;
      try {
        mensaje = (JSON.parse(texto) as { error?: { message?: string } }).error?.message ?? texto;
      } catch {
        // texto no era JSON — se usa tal cual.
      }
      throw new ServiceUnavailableException(`Nginx Proxy Manager: ${mensaje}`);
    }
    return texto ? (JSON.parse(texto) as T) : (undefined as T);
  }

  /**
   * Certificado Let's Encrypt vía HTTP-01 (a diferencia del wildcard que ya
   * cubre `*.ciguadev.com`) — exige que el DNS del dominio YA apunte al
   * servidor antes de llamar esto, porque el challenge le pega al dominio
   * real. Llamar después de confirmar el DNS (ver `TenantDominiosService`).
   */
  async emitirCertificado(dominios: string[], email: string): Promise<number> {
    const creado = await this.peticion<{ id: number }>('POST', '/api/nginx/certificates', {
      provider: 'letsencrypt',
      domain_names: dominios,
      meta: { letsencrypt_email: email, letsencrypt_agree: true, dns_challenge: false },
    });
    return creado.id;
  }

  /** El certificado ya se pasa creado (`emitirCertificado`) — se crea el Proxy Host con SSL forzado desde el arranque, sin un PUT de asociación aparte. */
  async crearProxyHost(dominios: string[], certificadoId: number): Promise<number> {
    const { forwardHost, forwardPort } = await this.token();
    const creado = await this.peticion<{ id: number }>('POST', '/api/nginx/proxy-hosts', {
      domain_names: dominios,
      forward_scheme: 'http',
      forward_host: forwardHost,
      forward_port: forwardPort,
      certificate_id: certificadoId,
      ssl_forced: true,
      http2_support: true,
      block_exploits: true,
      allow_websocket_upgrade: true,
      caching_enabled: false,
    });
    return creado.id;
  }

  /** Best-effort — quien llama decide si un fallo acá bloquea o no la operación (ver TenantDominiosService.eliminar). */
  async eliminarProxyHost(id: number): Promise<void> {
    await this.peticion('DELETE', `/api/nginx/proxy-hosts/${id}`);
  }
}
