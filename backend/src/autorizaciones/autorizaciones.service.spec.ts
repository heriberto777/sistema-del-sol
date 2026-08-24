import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AutorizacionesService } from './autorizaciones.service';
import { AutorizacionesRepository } from './autorizaciones.repository';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { ConfiguracionesService } from '../configuraciones/configuraciones.service';

describe('AutorizacionesService', () => {
  let service: AutorizacionesService;
  let repository: jest.Mocked<AutorizacionesRepository>;
  let emailChannel: jest.Mocked<EmailChannel>;
  let configuracionesService: jest.Mocked<ConfiguracionesService>;

  beforeEach(() => {
    repository = {
      resolverDestinatarios: jest.fn(),
      invalidarPendientes: jest.fn(),
      crear: jest.fn(),
      buscarPendiente: jest.fn(),
      registrarIntentoFallido: jest.fn(),
      marcarUsado: jest.fn(),
    } as unknown as jest.Mocked<AutorizacionesRepository>;
    emailChannel = { enviar: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<EmailChannel>;
    configuracionesService = { buscarValor: jest.fn() } as unknown as jest.Mocked<ConfiguracionesService>;
    service = new AutorizacionesService(repository, emailChannel, configuracionesService);
  });

  describe('estaHabilitada', () => {
    it('lee la clave AUTORIZACION_2FA_ANULAR para ANULACION_FACTURA, default false', async () => {
      configuracionesService.buscarValor.mockResolvedValue('false');

      const resultado = await service.estaHabilitada('ANULACION_FACTURA', 'tenant-1');

      expect(configuracionesService.buscarValor).toHaveBeenCalledWith('AUTORIZACION_2FA_ANULAR', 'tenant-1', 'false');
      expect(resultado).toBe(false);
    });

    it('lee la clave AUTORIZACION_2FA_DEVOLUCION para DEVOLUCION_POS', async () => {
      configuracionesService.buscarValor.mockResolvedValue('true');

      const resultado = await service.estaHabilitada('DEVOLUCION_POS', 'tenant-1');

      expect(configuracionesService.buscarValor).toHaveBeenCalledWith('AUTORIZACION_2FA_DEVOLUCION', 'tenant-1', 'false');
      expect(resultado).toBe(true);
    });
  });

  describe('solicitar', () => {
    it('rechaza con 400 si no hay ningún destinatario (ni encargado ni Admin Total)', async () => {
      repository.resolverDestinatarios.mockResolvedValue([]);

      await expect(
        service.solicitar({
          tenantId: 't1',
          tipo: 'ANULACION_FACTURA',
          referenciaId: 'f1',
          sucursalId: null,
          solicitadoPorId: 'u1',
          monto: 100,
          descripcion: 'Anulación de factura B0200000001',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('invalida códigos pendientes anteriores, genera uno nuevo y lo manda a todos los destinatarios', async () => {
      repository.resolverDestinatarios.mockResolvedValue([
        { id: 'sup-1', nombre: 'Supervisor Uno', email: 'supervisor@ejemplo.com' },
        { id: 'admin-1', nombre: 'Admin Total', email: 'admin@ejemplo.com' },
      ]);

      const resultado = await service.solicitar({
        tenantId: 't1',
        tipo: 'ANULACION_FACTURA',
        referenciaId: 'f1',
        sucursalId: 's1',
        solicitadoPorId: 'u1',
        monto: 236,
        descripcion: 'Anulación de factura B0200000001',
      });

      expect(repository.invalidarPendientes).toHaveBeenCalledWith('ANULACION_FACTURA', 'f1');
      expect(repository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', tipo: 'ANULACION_FACTURA', referenciaId: 'f1', solicitadoPorId: 'u1' }),
      );
      expect(emailChannel.enviar).toHaveBeenCalledTimes(2);
      expect(emailChannel.enviar).toHaveBeenCalledWith('supervisor@ejemplo.com', expect.any(String), expect.any(String));
      expect(emailChannel.enviar).toHaveBeenCalledWith('admin@ejemplo.com', expect.any(String), expect.any(String));
      expect(resultado.enviadoA).toHaveLength(2);
      expect(resultado.enviadoA[0]).not.toContain('supervisor@ejemplo.com'); // ofuscado, no el email completo
      expect(resultado.expiraEn.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('verificar', () => {
    it('rechaza con 400 si no hay un código pendiente', async () => {
      repository.buscarPendiente.mockResolvedValue(null);

      await expect(service.verificar('ANULACION_FACTURA', 'f1', '123456')).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 400 si el código pendiente ya venció', async () => {
      repository.buscarPendiente.mockResolvedValue({
        id: 'c1',
        expiraEn: new Date(Date.now() - 1000),
        intentosFallidos: 0,
        codigoHash: 'hash',
      } as never);

      await expect(service.verificar('ANULACION_FACTURA', 'f1', '123456')).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 403 si ya se agotaron los intentos', async () => {
      repository.buscarPendiente.mockResolvedValue({
        id: 'c1',
        expiraEn: new Date(Date.now() + 60000),
        intentosFallidos: 5,
        codigoHash: 'hash',
      } as never);

      await expect(service.verificar('ANULACION_FACTURA', 'f1', '123456')).rejects.toThrow(ForbiddenException);
    });

    it('rechaza con 403 y registra el intento fallido si el código no coincide', async () => {
      repository.buscarPendiente.mockResolvedValue({
        id: 'c1',
        expiraEn: new Date(Date.now() + 60000),
        intentosFallidos: 1,
        codigoHash: await bcrypt.hash('654321', 10),
      } as never);

      await expect(service.verificar('ANULACION_FACTURA', 'f1', '123456')).rejects.toThrow(ForbiddenException);
      expect(repository.registrarIntentoFallido).toHaveBeenCalledWith('c1', 2);
      expect(repository.marcarUsado).not.toHaveBeenCalled();
    });

    it('rechaza con 403 si no se envía ningún código', async () => {
      repository.buscarPendiente.mockResolvedValue({
        id: 'c1',
        expiraEn: new Date(Date.now() + 60000),
        intentosFallidos: 0,
        codigoHash: 'hash',
      } as never);

      await expect(service.verificar('ANULACION_FACTURA', 'f1', undefined)).rejects.toThrow(ForbiddenException);
    });

    it('marca el código como usado cuando coincide', async () => {
      const codigoHash = await bcrypt.hash('654321', 10);
      repository.buscarPendiente.mockResolvedValue({
        id: 'c1',
        expiraEn: new Date(Date.now() + 60000),
        intentosFallidos: 0,
        codigoHash,
      } as never);

      await service.verificar('ANULACION_FACTURA', 'f1', '654321');

      expect(repository.marcarUsado).toHaveBeenCalledWith('c1');
      expect(repository.registrarIntentoFallido).not.toHaveBeenCalled();
    });
  });
});
