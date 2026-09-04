import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TenantDominiosService } from './tenant-dominios.service';
import { TenantDominiosRepository } from './tenant-dominios.repository';
import { NpmClientService } from '../plataforma-config/npm/npm-client.service';
import { PlataformaConfigRepository } from '../plataforma-config/plataforma-config.repository';

const resolve4 = jest.fn();
const resolveCname = jest.fn();
jest.mock('dns', () => ({
  promises: {
    resolve4: (...args: unknown[]) => resolve4(...args),
    resolveCname: (...args: unknown[]) => resolveCname(...args),
  },
}));

describe('TenantDominiosService', () => {
  let service: TenantDominiosService;
  let repo: jest.Mocked<TenantDominiosRepository>;
  let npm: jest.Mocked<NpmClientService>;
  let plataformaConfigRepo: jest.Mocked<PlataformaConfigRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = {
      listarPorTenant: jest.fn(),
      buscarPorId: jest.fn(),
      buscarPorDominio: jest.fn(),
      buscarActivoPorDominio: jest.fn(),
      crear: jest.fn(),
      actualizarEstado: jest.fn(),
      eliminar: jest.fn(),
    } as unknown as jest.Mocked<TenantDominiosRepository>;
    npm = {
      emitirCertificado: jest.fn(),
      crearProxyHost: jest.fn(),
      eliminarProxyHost: jest.fn(),
    } as unknown as jest.Mocked<NpmClientService>;
    plataformaConfigRepo = {
      obtenerOCrear: jest.fn(),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<PlataformaConfigRepository>;
    service = new TenantDominiosService(repo, npm, plataformaConfigRepo);
  });

  describe('agregar', () => {
    it('rechaza un dominio con formato inválido', async () => {
      await expect(service.agregar('t1', 'no es un dominio')).rejects.toThrow(BadRequestException);
    });

    it('rechaza un subdominio de ciguadev.com — ese camino ya existe vía Tenant.subdominio', async () => {
      await expect(service.agregar('t1', 'emelinda.ciguadev.com')).rejects.toThrow(BadRequestException);
    });

    it('rechaza un dominio ya asignado a otro tenant', async () => {
      repo.buscarPorDominio.mockResolvedValue({ id: 'd1' } as never);
      await expect(service.agregar('t1', 'shopy-me.com')).rejects.toThrow(ConflictException);
    });

    it('normaliza protocolo/mayúsculas/ruta antes de guardar', async () => {
      repo.buscarPorDominio.mockResolvedValue(null);
      repo.crear.mockResolvedValue({ id: 'd1' } as never);

      await service.agregar('t1', 'HTTPS://Shopy-Me.com/algo');

      expect(repo.crear).toHaveBeenCalledWith('t1', 'shopy-me.com');
    });
  });

  describe('verificarYActivar', () => {
    it('lanza NotFoundException si el dominio no existe', async () => {
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.verificarYActivar('d1')).rejects.toThrow(NotFoundException);
    });

    it('sin npmPublicHost configurado, cae a ERROR con mensaje explicando qué falta', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'd1', dominio: 'shopy-me.com' } as never);
      plataformaConfigRepo.obtenerOCrear.mockResolvedValue({ npmPublicHost: null } as never);

      await service.verificarYActivar('d1');

      expect(repo.actualizarEstado).toHaveBeenCalledWith('d1', expect.objectContaining({ estado: 'ERROR' }));
      expect(npm.emitirCertificado).not.toHaveBeenCalled();
    });

    it('con DNS (A record) que no apunta al host público, cae a ERROR sin llamar a NPM', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'd1', dominio: 'shopy-me.com' } as never);
      plataformaConfigRepo.obtenerOCrear.mockResolvedValue({ npmPublicHost: '10.0.10.5' } as never);
      resolve4.mockResolvedValue(['1.2.3.4']);

      await service.verificarYActivar('d1');

      const ultimaLlamada = repo.actualizarEstado.mock.calls.at(-1)!;
      expect(ultimaLlamada[1]).toEqual(expect.objectContaining({ estado: 'ERROR' }));
      expect(npm.emitirCertificado).not.toHaveBeenCalled();
    });

    it('con DNS que sí apunta bien, emite el certificado, crea el Proxy Host y marca ACTIVO', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'd1', dominio: 'shopy-me.com' } as never);
      plataformaConfigRepo.obtenerOCrear.mockResolvedValue({ npmPublicHost: '10.0.10.5' } as never);
      resolve4.mockResolvedValue(['10.0.10.5']);
      npm.emitirCertificado.mockResolvedValue(42);
      npm.crearProxyHost.mockResolvedValue(99);

      await service.verificarYActivar('d1');

      expect(npm.emitirCertificado).toHaveBeenCalledWith(['shopy-me.com']);
      expect(npm.crearProxyHost).toHaveBeenCalledWith(['shopy-me.com'], 42);
      const ultimaLlamada = repo.actualizarEstado.mock.calls.at(-1)!;
      expect(ultimaLlamada[1]).toEqual(
        expect.objectContaining({ estado: 'ACTIVO', npmProxyHostId: 99, npmCertificadoId: 42, mensajeError: null }),
      );
    });

    it('con CNAME (host público no-IP) que sí apunta bien, también activa', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'd1', dominio: 'www.shopy-me.com' } as never);
      plataformaConfigRepo.obtenerOCrear.mockResolvedValue({ npmPublicHost: 'app.ciguadev.com' } as never);
      resolveCname.mockResolvedValue(['app.ciguadev.com.']);
      npm.emitirCertificado.mockResolvedValue(1);
      npm.crearProxyHost.mockResolvedValue(2);

      await service.verificarYActivar('d1');

      const ultimaLlamada = repo.actualizarEstado.mock.calls.at(-1)!;
      expect(ultimaLlamada[1]).toEqual(expect.objectContaining({ estado: 'ACTIVO' }));
    });

    it('si NPM falla (ej. rate limit de Let\'s Encrypt), cae a ERROR con el mensaje crudo', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'd1', dominio: 'shopy-me.com' } as never);
      plataformaConfigRepo.obtenerOCrear.mockResolvedValue({ npmPublicHost: '10.0.10.5' } as never);
      resolve4.mockResolvedValue(['10.0.10.5']);
      npm.emitirCertificado.mockRejectedValue(new Error('Nginx Proxy Manager: too many certificates already issued'));

      await service.verificarYActivar('d1');

      const ultimaLlamada = repo.actualizarEstado.mock.calls.at(-1)!;
      expect(ultimaLlamada[1]).toEqual(
        expect.objectContaining({ estado: 'ERROR', mensajeError: expect.stringContaining('too many certificates') }),
      );
    });
  });

  describe('eliminar', () => {
    it('lanza NotFoundException si el dominio no existe', async () => {
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.eliminar('d1')).rejects.toThrow(NotFoundException);
    });

    it('borra el registro aunque falle el borrado en NPM (best-effort)', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'd1', npmProxyHostId: 7 } as never);
      npm.eliminarProxyHost.mockRejectedValue(new Error('NPM caído'));

      await service.eliminar('d1');

      expect(repo.eliminar).toHaveBeenCalledWith('d1');
    });

    it('sin npmProxyHostId (nunca se llegó a activar), no llama a NPM', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'd1', npmProxyHostId: null } as never);

      await service.eliminar('d1');

      expect(npm.eliminarProxyHost).not.toHaveBeenCalled();
      expect(repo.eliminar).toHaveBeenCalledWith('d1');
    });
  });
});
