import { BadRequestException } from '@nestjs/common';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { PlataformaWebhookChannel } from '../plataforma-config/plataforma-webhook.channel';
import { PrismaService } from '../prisma/prisma.service';

describe('FacturasPlataformaService', () => {
  let service: FacturasPlataformaService;
  let repo: jest.Mocked<FacturasPlataformaRepository>;
  let emailChannel: jest.Mocked<EmailChannel>;
  let plataformaWebhookChannel: jest.Mocked<PlataformaWebhookChannel>;
  let prisma: { user: { findFirst: jest.Mock }; suscripcion: { findUnique: jest.Mock } };

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
    plataformaWebhookChannel = { enviar: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<PlataformaWebhookChannel>;
    prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ email: 'admin@tenant.com' }) },
      suscripcion: { findUnique: jest.fn().mockResolvedValue({ id: 's1', tenantId: 't1' }) },
    };
    service = new FacturasPlataformaService(repo, emailChannel, plataformaWebhookChannel, prisma as unknown as PrismaService);
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

  describe('crearManual', () => {
    it('suma el monto de las líneas, arma un concepto resumido, y guarda las líneas en el repositorio', async () => {
      repo.crear.mockResolvedValue({ id: 'f1' } as never);
      repo.buscarPorId.mockResolvedValue({ id: 'f1', concepto: 'x', total: 350, fechaVencimiento: new Date() } as never);

      await service.crearManual({
        tenantId: 't1',
        lineas: [
          { concepto: 'Configuración inicial', monto: 200 },
          { concepto: 'Capacitación', monto: 150 },
        ],
      });

      const [args] = repo.crear.mock.calls[0];
      expect(args.tenantId).toBe('t1');
      expect(args.suscripcionId).toBe('s1');
      expect(args.monto).toBe(350);
      expect(args.total).toBe(350);
      expect(args.concepto).toBe('Configuración inicial (+1 más)');
      expect(args.lineas).toEqual([
        { concepto: 'Configuración inicial', monto: 200 },
        { concepto: 'Capacitación', monto: 150 },
      ]);
      expect(emailChannel.enviar).toHaveBeenCalled();
    });

    it('con una sola línea, usa su concepto tal cual (sin el sufijo "+N más")', async () => {
      repo.crear.mockResolvedValue({ id: 'f1' } as never);
      repo.buscarPorId.mockResolvedValue({ id: 'f1', concepto: 'x', total: 100, fechaVencimiento: new Date() } as never);

      await service.crearManual({ tenantId: 't1', lineas: [{ concepto: 'Cargo único', monto: 100 }] });

      const [args] = repo.crear.mock.calls[0];
      expect(args.concepto).toBe('Cargo único');
    });

    it('rechaza con 400 si el tenant no tiene Suscripcion', async () => {
      prisma.suscripcion.findUnique.mockResolvedValue(null);

      await expect(service.crearManual({ tenantId: 't1', lineas: [{ concepto: 'x', monto: 10 }] })).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.crear).not.toHaveBeenCalled();
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

  describe('notificarPorRegla (Fase 4)', () => {
    const factura = { id: 'f1', tenantId: 't1', concepto: 'Suscripción X', total: 1000, fechaVencimiento: new Date('2026-03-01T00:00:00Z') };

    it('canal WEBHOOK delega en PlataformaWebhookChannel con el payload de la factura, sin tocar email', async () => {
      repo.buscarPorId.mockResolvedValue(factura as never);

      await service.notificarPorRegla('f1', -3, 'WEBHOOK');

      expect(plataformaWebhookChannel.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ facturaId: 'f1', tenantId: 't1', concepto: 'Suscripción X', total: '1000', offsetDias: -3 }),
      );
      expect(emailChannel.enviar).not.toHaveBeenCalled();
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('canal EMAIL busca el Admin Total más antiguo del tenant y le envía el aviso', async () => {
      repo.buscarPorId.mockResolvedValue(factura as never);

      await service.notificarPorRegla('f1', 5, 'EMAIL');

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1' }), orderBy: { createdAt: 'asc' } }),
      );
      expect(emailChannel.enviar).toHaveBeenCalledWith('admin@tenant.com', expect.any(String), expect.stringContaining('Suscripción X'));
      expect(plataformaWebhookChannel.enviar).not.toHaveBeenCalled();
    });

    it('canal EMAIL sin ningún Admin Total en el tenant no envía nada (solo loguea)', async () => {
      repo.buscarPorId.mockResolvedValue(factura as never);
      prisma.user.findFirst.mockResolvedValue(null);

      await service.notificarPorRegla('f1', 5, 'EMAIL');

      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });
  });
});
