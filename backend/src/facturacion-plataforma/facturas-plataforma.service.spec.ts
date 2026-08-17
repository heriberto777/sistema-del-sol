import { BadRequestException } from '@nestjs/common';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { PrismaService } from '../prisma/prisma.service';

describe('FacturasPlataformaService', () => {
  let service: FacturasPlataformaService;
  let repo: jest.Mocked<FacturasPlataformaRepository>;
  let emailChannel: jest.Mocked<EmailChannel>;
  let prisma: { user: { findFirst: jest.Mock } };

  beforeEach(() => {
    repo = {
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      marcarEstado: jest.fn(),
      contarPagos: jest.fn(),
      listarVencidasPendientes: jest.fn(),
    } as unknown as jest.Mocked<FacturasPlataformaRepository>;
    emailChannel = { enviar: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<EmailChannel>;
    prisma = { user: { findFirst: jest.fn().mockResolvedValue({ email: 'admin@tenant.com' }) } };
    service = new FacturasPlataformaService(repo, emailChannel, prisma as unknown as PrismaService);
  });

  describe('generarDesdeSuscripcion', () => {
    it('crea la factura con monto/total igual al precio del plan y notifica al admin del tenant', async () => {
      const suscripcion = {
        id: 's1',
        tenantId: 't1',
        plan: { nombre: 'Premium', precio: 1500, cicloFacturacion: 'MENSUAL' },
      } as never;
      repo.crear.mockResolvedValue({ id: 'f1', concepto: 'x', total: 1500, fechaVencimiento: new Date() } as never);
      repo.buscarPorId.mockResolvedValue({ id: 'f1', concepto: 'x', total: 1500, fechaVencimiento: new Date() } as never);

      await service.generarDesdeSuscripcion(suscripcion);

      const [args] = repo.crear.mock.calls[0];
      expect(args.tenantId).toBe('t1');
      expect(args.monto).toBe(1500);
      expect(args.total).toBe(1500);
      expect(emailChannel.enviar).toHaveBeenCalledWith('admin@tenant.com', expect.any(String), expect.any(String));
    });

    it('no falla si el tenant no tiene ningún usuario Admin Total (solo loguea)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const suscripcion = { id: 's1', tenantId: 't1', plan: { nombre: 'Básico', precio: 500, cicloFacturacion: 'MENSUAL' } } as never;
      repo.crear.mockResolvedValue({ id: 'f1' } as never);

      await expect(service.generarDesdeSuscripcion(suscripcion)).resolves.toBeDefined();
      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });
  });

  describe('actualizar', () => {
    it('recalcula total = monto - descuento + montoMora', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PENDIENTE', monto: 1000, descuento: 0, montoMora: 0 } as never);

      await service.actualizar('f1', { descuento: 100 });

      expect(repo.actualizar).toHaveBeenCalledWith('f1', expect.objectContaining({ descuento: 100, total: 900 }));
    });

    it('rechaza editar una factura PAGADA', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PAGADA' } as never);
      await expect(service.actualizar('f1', { descuento: 10 })).rejects.toThrow(BadRequestException);
    });

    it('rechaza editar una factura ANULADA', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'ANULADA' } as never);
      await expect(service.actualizar('f1', { descuento: 10 })).rejects.toThrow(BadRequestException);
    });

    it('rechaza un descuento que deje el total negativo', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PENDIENTE', monto: 500, descuento: 0, montoMora: 0 } as never);
      await expect(service.actualizar('f1', { descuento: 600 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('anular', () => {
    it('rechaza anular una factura ya PAGADA', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PAGADA' } as never);
      await expect(service.anular('f1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza anular una factura ya ANULADA', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'ANULADA' } as never);
      await expect(service.anular('f1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza anular una factura con pagos parciales registrados', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PENDIENTE' } as never);
      repo.contarPagos.mockResolvedValue(1);
      await expect(service.anular('f1')).rejects.toThrow(BadRequestException);
    });

    it('anula una factura PENDIENTE sin pagos', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PENDIENTE' } as never);
      repo.contarPagos.mockResolvedValue(0);

      await service.anular('f1');

      expect(repo.marcarEstado).toHaveBeenCalledWith('f1', 'ANULADA');
    });
  });

  describe('marcarVencidaConMora', () => {
    it('aplica el % de mora sobre el total y marca VENCIDA', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'f1', tenantId: 't1', total: 1000, concepto: 'x', fechaVencimiento: new Date() } as never);

      await service.marcarVencidaConMora('f1', 5);

      expect(repo.actualizar).toHaveBeenCalledWith('f1', { montoMora: 50, total: 1050 });
      expect(repo.marcarEstado).toHaveBeenCalledWith('f1', 'VENCIDA');
    });
  });
});
