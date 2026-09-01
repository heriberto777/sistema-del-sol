import { BadRequestException } from '@nestjs/common';
import { FacturasPlataformaService } from './facturas-plataforma.service';
import { FacturasPlataformaRepository } from './facturas-plataforma.repository';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { WhatsAppChannel } from '../notificaciones/canales/whatsapp.channel';
import { PlataformaWebhookChannel } from '../plataforma-config/plataforma-webhook.channel';
import { PlataformaConfigRepository } from '../plataforma-config/plataforma-config.repository';
import { NcfPlataformaService } from '../ncf-plataforma/ncf-plataforma.service';
import { EmisionECfService } from '../emision-ecf/emision-ecf.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FacturasPlataformaService', () => {
  let service: FacturasPlataformaService;
  let repo: jest.Mocked<FacturasPlataformaRepository>;
  let emailChannel: jest.Mocked<EmailChannel>;
  let whatsAppChannel: jest.Mocked<WhatsAppChannel>;
  let plataformaWebhookChannel: jest.Mocked<PlataformaWebhookChannel>;
  let plataformaConfigRepository: jest.Mocked<PlataformaConfigRepository>;
  let ncfPlataformaService: jest.Mocked<NcfPlataformaService>;
  let emisionECfService: jest.Mocked<EmisionECfService>;
  let prisma: { user: { findFirst: jest.Mock }; suscripcion: { findUnique: jest.Mock }; tenant: { findUnique: jest.Mock } };

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
    whatsAppChannel = { enviar: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<WhatsAppChannel>;
    plataformaWebhookChannel = { enviar: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<PlataformaWebhookChannel>;
    plataformaConfigRepository = {
      obtenerOCrear: jest.fn().mockResolvedValue({ porcentajeItbis: 0 }),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<PlataformaConfigRepository>;
    ncfPlataformaService = { asignarSiguiente: jest.fn().mockResolvedValue(null) } as unknown as jest.Mocked<NcfPlataformaService>;
    emisionECfService = { emitirParaFacturaPlataforma: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<EmisionECfService>;
    prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ email: 'admin@tenant.com' }) },
      suscripcion: { findUnique: jest.fn().mockResolvedValue({ id: 's1', tenantId: 't1' }) },
      tenant: { findUnique: jest.fn().mockResolvedValue({ telefono: '+18095551234' }) },
    };
    service = new FacturasPlataformaService(
      repo,
      emailChannel,
      whatsAppChannel,
      plataformaWebhookChannel,
      plataformaConfigRepository,
      ncfPlataformaService,
      emisionECfService,
      prisma as unknown as PrismaService,
    );
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

    it('incluye el ncf/tipoNcf asignado por NcfPlataformaService cuando hay uno disponible', async () => {
      ncfPlataformaService.asignarSiguiente.mockResolvedValue({ ncf: 'B0100000005', tipoNcf: 'B01' });
      const suscripcion = { id: 's1', tenantId: 't1', plan: { nombre: 'Premium', precio: 1500, cicloFacturacion: 'MENSUAL' } } as never;
      repo.crear.mockResolvedValue({ id: 'f1' } as never);
      repo.buscarPorId.mockResolvedValue({ id: 'f1', concepto: 'x', total: 1500, fechaVencimiento: new Date() } as never);

      await service.generarDesdeSuscripcion(suscripcion);

      const [args] = repo.crear.mock.calls[0];
      expect(args.ncf).toBe('B0100000005');
      expect(args.tipoNcf).toBe('B01');
    });

    it('llama a EmisionECfService.emitirParaFacturaPlataforma con el id de la factura recién creada', async () => {
      const suscripcion = { id: 's1', tenantId: 't1', plan: { nombre: 'Premium', precio: 1500, cicloFacturacion: 'MENSUAL' } } as never;
      repo.crear.mockResolvedValue({ id: 'f1' } as never);
      repo.buscarPorId.mockResolvedValue({ id: 'f1', concepto: 'x', total: 1500, fechaVencimiento: new Date() } as never);

      await service.generarDesdeSuscripcion(suscripcion);

      expect(emisionECfService.emitirParaFacturaPlataforma).toHaveBeenCalledWith('f1');
    });

    it('crea la factura sin ncf si NcfPlataformaService no pudo asignar ninguno (sin secuencia configurada)', async () => {
      ncfPlataformaService.asignarSiguiente.mockResolvedValue(null);
      const suscripcion = { id: 's1', tenantId: 't1', plan: { nombre: 'Premium', precio: 1500, cicloFacturacion: 'MENSUAL' } } as never;
      repo.crear.mockResolvedValue({ id: 'f1' } as never);
      repo.buscarPorId.mockResolvedValue({ id: 'f1', concepto: 'x', total: 1500, fechaVencimiento: new Date() } as never);

      await service.generarDesdeSuscripcion(suscripcion);

      const [args] = repo.crear.mock.calls[0];
      expect(args.ncf).toBeUndefined();
    });

    it('calcula itbis sobre el precio del plan y lo suma al total, con porcentajeItbis configurado', async () => {
      plataformaConfigRepository.obtenerOCrear.mockResolvedValue({ porcentajeItbis: 18 } as never);
      const suscripcion = { id: 's1', tenantId: 't1', plan: { nombre: 'Premium', precio: 1500, cicloFacturacion: 'MENSUAL' } } as never;
      repo.crear.mockResolvedValue({ id: 'f1' } as never);
      repo.buscarPorId.mockResolvedValue({ id: 'f1', concepto: 'x', total: 1770, fechaVencimiento: new Date() } as never);

      await service.generarDesdeSuscripcion(suscripcion);

      const [args] = repo.crear.mock.calls[0];
      expect(args.monto).toBe(1500);
      expect(args.itbis).toBe(270);
      expect(args.total).toBe(1770);
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

  describe('generarPdf', () => {
    const factura = {
      id: 'f1',
      ncf: 'B0100000005',
      concepto: 'Suscripción Premium',
      monto: 1500,
      descuento: 0,
      montoMora: 0,
      itbis: 270,
      total: 1770,
      fechaEmision: new Date('2026-01-15'),
      tenant: { nombre: 'Tenant Demo', rnc: '131234567' },
      lineas: [],
    };

    it('genera un PDF con el NCF y el tenant en el número/cliente cuando la empresa emisora está configurada', async () => {
      repo.buscarPorId.mockResolvedValue(factura as never);
      plataformaConfigRepository.obtenerOCrear.mockResolvedValue({ nombreNegocio: 'Mi SaaS', rnc: '101000000', direccion: null, telefono: null } as never);

      const buffer = await service.generarPdf('f1');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    it('genera el PDF igual sin bloque de emisor si la empresa no tiene nombreNegocio configurado', async () => {
      repo.buscarPorId.mockResolvedValue(factura as never);
      plataformaConfigRepository.obtenerOCrear.mockResolvedValue({ nombreNegocio: null } as never);

      await expect(service.generarPdf('f1')).resolves.toBeInstanceOf(Buffer);
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

    it('no agrega itbis a una factura vieja (itbis: 0) aunque se le cambie el descuento — forward-only', async () => {
      plataformaConfigRepository.obtenerOCrear.mockResolvedValue({ porcentajeItbis: 18 } as never);
      repo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PENDIENTE', monto: 1000, descuento: 0, montoMora: 0, itbis: 0 } as never);

      await service.actualizar('f1', { descuento: 100 });

      expect(repo.actualizar).toHaveBeenCalledWith('f1', expect.objectContaining({ itbis: 0, total: 900 }));
    });

    it('recalcula itbis sobre el neto si la factura ya tenía itbis al crearse', async () => {
      plataformaConfigRepository.obtenerOCrear.mockResolvedValue({ porcentajeItbis: 18 } as never);
      repo.buscarPorId.mockResolvedValue({ id: 'f1', estado: 'PENDIENTE', monto: 1000, descuento: 0, montoMora: 0, itbis: 180 } as never);

      await service.actualizar('f1', { descuento: 100 });

      // subtotalNeto = 900, itbis = 162, total = 900 + 162 + 0
      expect(repo.actualizar).toHaveBeenCalledWith('f1', expect.objectContaining({ itbis: 162, total: 1062 }));
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

    it('canal WHATSAPP envía al teléfono del Tenant (empresa), no a un usuario', async () => {
      repo.buscarPorId.mockResolvedValue(factura as never);

      await service.notificarPorRegla('f1', -3, 'WHATSAPP');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 't1' }, select: { telefono: true } });
      expect(whatsAppChannel.enviar).toHaveBeenCalledWith('+18095551234', '', expect.stringContaining('Suscripción X'));
      expect(emailChannel.enviar).not.toHaveBeenCalled();
      expect(plataformaWebhookChannel.enviar).not.toHaveBeenCalled();
    });

    it('canal WHATSAPP sin teléfono configurado en el tenant no envía nada (solo loguea)', async () => {
      repo.buscarPorId.mockResolvedValue(factura as never);
      prisma.tenant.findUnique.mockResolvedValue({ telefono: null });

      await service.notificarPorRegla('f1', -3, 'WHATSAPP');

      expect(whatsAppChannel.enviar).not.toHaveBeenCalled();
    });
  });
});
