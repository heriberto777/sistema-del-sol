import { NotificacionesService } from './notificaciones.service';
import { NotificacionesRepository } from './notificaciones.repository';
import { EmailChannel } from './canales/email.channel';
import { WhatsAppChannel } from './canales/whatsapp.channel';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let repository: jest.Mocked<NotificacionesRepository>;
  let emailChannel: jest.Mocked<EmailChannel>;
  let whatsAppChannel: jest.Mocked<WhatsAppChannel>;
  let prisma: { cliente: any; user: any };

  beforeEach(() => {
    repository = {
      buscarPlantilla: jest.fn(),
      crearNotificacion: jest.fn(),
      marcarEstado: jest.fn(),
      listarPlantillas: jest.fn(),
      upsertPlantilla: jest.fn(),
      listarPorTenant: jest.fn(),
    } as unknown as jest.Mocked<NotificacionesRepository>;
    emailChannel = { enviar: jest.fn() } as unknown as jest.Mocked<EmailChannel>;
    whatsAppChannel = { enviar: jest.fn() } as unknown as jest.Mocked<WhatsAppChannel>;
    prisma = { cliente: { findUnique: jest.fn() }, user: { findMany: jest.fn() } };
    service = new NotificacionesService(repository, emailChannel, whatsAppChannel, prisma as unknown as PrismaService);
  });

  describe('enviar', () => {
    it('no envía nada ni crea registro si no hay plantilla activa', async () => {
      repository.buscarPlantilla.mockResolvedValue(null);

      const resultado = await service.enviar({ tenantId: 't1', canal: 'EMAIL', clave: 'x', destinatario: 'a@b.com', variables: {} });

      expect(resultado).toBeNull();
      expect(repository.crearNotificacion).not.toHaveBeenCalled();
      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('canal EMAIL despacha por EmailChannel, no por WhatsApp', async () => {
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: 'Hola', cuerpo: 'Cuerpo' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.enviar({ tenantId: 't1', canal: 'EMAIL', clave: 'x', destinatario: 'a@b.com', variables: {} });

      expect(emailChannel.enviar).toHaveBeenCalledWith('a@b.com', 'Hola', 'Cuerpo');
      expect(whatsAppChannel.enviar).not.toHaveBeenCalled();
      expect(repository.marcarEstado).toHaveBeenCalledWith('n1', 'ENVIADA');
    });

    it('canal WHATSAPP despacha por WhatsAppChannel, no por Email', async () => {
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'Tu factura fue emitida' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      whatsAppChannel.enviar.mockResolvedValue(true);

      await service.enviar({ tenantId: 't1', canal: 'WHATSAPP', clave: 'factura_creada', destinatario: '+18095551234', variables: {} });

      expect(whatsAppChannel.enviar).toHaveBeenCalledWith('+18095551234', '', 'Tu factura fue emitida');
      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('marca FALLIDA si el canal reporta que no pudo enviar', async () => {
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      whatsAppChannel.enviar.mockResolvedValue(false);

      await service.enviar({ tenantId: 't1', canal: 'WHATSAPP', clave: 'x', destinatario: '+1', variables: {} });

      expect(repository.marcarEstado).toHaveBeenCalledWith('n1', 'FALLIDA');
    });

    it('canal IN_APP no despacha por ningún canal externo pero sí marca ENVIADA', async () => {
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);

      await service.enviar({ tenantId: 't1', canal: 'IN_APP', clave: 'x', destinatario: 'user-1', variables: {} });

      expect(emailChannel.enviar).not.toHaveBeenCalled();
      expect(whatsAppChannel.enviar).not.toHaveBeenCalled();
      expect(repository.marcarEstado).toHaveBeenCalledWith('n1', 'ENVIADA');
    });

    it('renderiza las variables en asunto y cuerpo antes de enviar', async () => {
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: 'Hola {{nombre}}', cuerpo: 'Total: {{total}}' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.enviar({ tenantId: 't1', canal: 'EMAIL', clave: 'x', destinatario: 'a@b.com', variables: { nombre: 'Ana', total: '100' } });

      expect(emailChannel.enviar).toHaveBeenCalledWith('a@b.com', 'Hola Ana', 'Total: 100');
    });
  });

  describe('alFacturarse', () => {
    it('envía por email y por WhatsApp cuando el cliente tiene ambos datos', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'c1', nombre: 'Cliente X', email: 'x@y.com', telefono: '+18095551234' });
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);
      whatsAppChannel.enviar.mockResolvedValue(true);

      await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '100', subtotal: '85', itbis: '15', tipoFactura: 'CONTADO' });

      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'factura_creada');
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'WHATSAPP', 'factura_creada');
    });

    it('no intenta WhatsApp si el cliente no tiene teléfono', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'c1', nombre: 'Cliente X', email: 'x@y.com', telefono: null });
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '100', subtotal: '85', itbis: '15', tipoFactura: 'CONTADO' });

      expect(repository.buscarPlantilla).not.toHaveBeenCalledWith('t1', 'WHATSAPP', 'factura_creada');
    });

    it('no intenta email si el cliente no tiene correo', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'c1', nombre: 'Cliente X', email: null, telefono: '+18095551234' });
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      whatsAppChannel.enviar.mockResolvedValue(true);

      await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '100', subtotal: '85', itbis: '15', tipoFactura: 'CONTADO' });

      expect(repository.buscarPlantilla).not.toHaveBeenCalledWith('t1', 'EMAIL', 'factura_creada');
    });

    it('no falla si el cliente ya no existe', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);

      await expect(
        service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '100', subtotal: '85', itbis: '15', tipoFactura: 'CONTADO' }),
      ).resolves.not.toThrow();
      expect(repository.buscarPlantilla).not.toHaveBeenCalled();
    });
  });

  describe('alEnviarCotizacion', () => {
    it('envía por email y por WhatsApp con las variables de la cotización', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'c1', nombre: 'Cliente X', email: 'x@y.com', telefono: '+18095551234' });
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);
      whatsAppChannel.enviar.mockResolvedValue(true);

      await service.alEnviarCotizacion({ tenantId: 't1', cotizacionId: 'cot1', clienteId: 'c1', numero: 'COT-001', total: '354' });

      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'cotizacion_enviada');
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'WHATSAPP', 'cotizacion_enviada');
    });

    it('no falla si el cliente ya no existe', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);

      await expect(
        service.alEnviarCotizacion({ tenantId: 't1', cotizacionId: 'cot1', clienteId: 'c1', numero: 'COT-001', total: '354' }),
      ).resolves.not.toThrow();
      expect(repository.buscarPlantilla).not.toHaveBeenCalled();
    });
  });

  describe('alVencerLote (Fase 5b)', () => {
    it('notifica por email a los usuarios con rol Admin Total/Almacenero', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'admin@x.com' }, { id: 'u2', email: 'almacen@x.com' }]);
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alVencerLote({
        tenantId: 't1',
        loteId: 'lote-1',
        productoNombre: 'Yogurt',
        numeroLote: 'L1',
        fechaVencimiento: '2026-09-01T00:00:00.000Z',
        cantidadActual: '5',
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', roles: { some: { role: { nombre: { in: ['Admin Total', 'Almacenero'] } } } } },
      });
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'lote_por_vencer');
      expect(emailChannel.enviar).toHaveBeenCalledTimes(2);
    });
  });
});
