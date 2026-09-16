import { NotificacionesService } from './notificaciones.service';
import { NotificacionesRepository } from './notificaciones.repository';
import { EmailChannel } from './canales/email.channel';
import { WhatsAppChannel } from './canales/whatsapp.channel';
import { PrismaService } from '../prisma/prisma.service';
import * as twilioWhatsappUtil from '../common/utils/twilio-whatsapp.util';

describe('NotificacionesService', () => {
  let service: NotificacionesService;
  let repository: jest.Mocked<NotificacionesRepository>;
  let emailChannel: jest.Mocked<EmailChannel>;
  let whatsAppChannel: jest.Mocked<WhatsAppChannel>;
  let prisma: { cliente: any; user: any; whatsappConfigTenant: any };

  beforeEach(() => {
    jest.restoreAllMocks();
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
    prisma = {
      cliente: { findUnique: jest.fn() },
      user: { findMany: jest.fn(), findUnique: jest.fn() },
      whatsappConfigTenant: { findUnique: jest.fn() },
    };
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

      expect(emailChannel.enviar).toHaveBeenCalledWith('a@b.com', 'Hola', 'Cuerpo', undefined, 't1');
      expect(whatsAppChannel.enviar).not.toHaveBeenCalled();
      expect(repository.marcarEstado).toHaveBeenCalledWith('n1', 'ENVIADA');
    });

    it('ítem H-4: reenvía adjuntoPdf a EmailChannel como un array de un elemento', async () => {
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: 'Hola', cuerpo: 'Cuerpo' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);
      const adjuntoPdf = { filename: 'factura.pdf', content: Buffer.from('pdf') };

      await service.enviar({ tenantId: 't1', canal: 'EMAIL', clave: 'x', destinatario: 'a@b.com', variables: {}, adjuntoPdf });

      expect(emailChannel.enviar).toHaveBeenCalledWith('a@b.com', 'Hola', 'Cuerpo', [adjuntoPdf], 't1');
    });

    it('canal WHATSAPP despacha por WhatsAppChannel, no por Email', async () => {
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'Tu factura fue emitida' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      whatsAppChannel.enviar.mockResolvedValue(true);

      await service.enviar({ tenantId: 't1', canal: 'WHATSAPP', clave: 'factura_creada', destinatario: '+18095551234', variables: {} });

      expect(whatsAppChannel.enviar).toHaveBeenCalledWith('+18095551234', '', 'Tu factura fue emitida', 't1');
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

      expect(emailChannel.enviar).toHaveBeenCalledWith('a@b.com', 'Hola Ana', 'Total: 100', undefined, 't1');
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

    it('ítem H-4: incluye el link público de la factura en las variables de AMBOS canales', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'c1', nombre: 'Cliente X', email: 'x@y.com', telefono: '+18095551234' });
      const enviarSpy = jest.spyOn(service, 'enviar').mockResolvedValue({ id: 'n1' } as never);

      await service.alFacturarse({ tenantId: 't1', facturaId: 'f1', clienteId: 'c1', total: '100', subtotal: '85', itbis: '15', tipoFactura: 'CONTADO' });

      expect(enviarSpy).toHaveBeenCalledWith(expect.objectContaining({ canal: 'EMAIL', variables: expect.objectContaining({ link: expect.stringContaining('/ver-factura/f1') }) }));
      expect(enviarSpy).toHaveBeenCalledWith(expect.objectContaining({ canal: 'WHATSAPP', variables: expect.objectContaining({ link: expect.stringContaining('/ver-factura/f1') }) }));
      // El link no depende de la factura completa — se arma solo con el id
      // del evento; el PDF adjunto (que sí la necesita) falla silenciosamente
      // sin romper el envío (PrismaService solo tiene cliente/user mockeados acá).
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

    it('ítem H-4: incluye el link público de la cotización en las variables', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'c1', nombre: 'Cliente X', email: 'x@y.com', telefono: '+18095551234' });
      const enviarSpy = jest.spyOn(service, 'enviar').mockResolvedValue({ id: 'n1' } as never);

      await service.alEnviarCotizacion({ tenantId: 't1', cotizacionId: 'cot1', clienteId: 'c1', numero: 'COT-001', total: '354' });

      expect(enviarSpy).toHaveBeenCalledWith(expect.objectContaining({ canal: 'EMAIL', variables: expect.objectContaining({ link: expect.stringContaining('/ver-cotizacion/cot1') }) }));
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

  describe('alRequerirAtencionWhatsapp (ítem H-2b)', () => {
    it('notifica por email a los usuarios con rol Admin Total, con el teléfono como variable', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'admin@x.com' }]);
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'Atender WhatsApp {{telefono}}' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alRequerirAtencionWhatsapp({ tenantId: 't1', mensajeId: 'm1', telefono: 'whatsapp:+18095551234' });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', roles: { some: { role: { nombre: 'Admin Total' } } } },
      });
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'whatsapp_requiere_atencion');
      expect(emailChannel.enviar).toHaveBeenCalledWith('admin@x.com', '', 'Atender WhatsApp whatsapp:+18095551234', undefined, 't1');
    });
  });

  describe('alVencerHitoProyecto / alSuperarPresupuestoProyecto (Proyectos)', () => {
    it('con responsableUserId presente y con usuario real, notifica SOLO a ese usuario', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-resp', email: 'responsable@x.com' });
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alVencerHitoProyecto({
        tenantId: 't1',
        hitoId: 'h1',
        hitoNombre: 'Entrega 1',
        proyectoNombre: 'Proyecto X',
        fechaObjetivo: '2026-09-10T00:00:00.000Z',
        responsableUserId: 'u-resp',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u-resp' } });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(emailChannel.enviar).toHaveBeenCalledTimes(1);
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'hito_proyecto_por_vencer');
    });

    it('sin responsableUserId, cae al fallback de todos los Admin Total del tenant', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'a1', email: 'admin1@x.com' }, { id: 'a2', email: 'admin2@x.com' }]);
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alVencerHitoProyecto({
        tenantId: 't1',
        hitoId: 'h1',
        hitoNombre: 'Entrega 1',
        proyectoNombre: 'Proyecto X',
        fechaObjetivo: '2026-09-10T00:00:00.000Z',
        responsableUserId: null,
      });

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { tenantId: 't1', roles: { some: { role: { nombre: 'Admin Total' } } } } });
      expect(emailChannel.enviar).toHaveBeenCalledTimes(2);
    });

    it('con responsableUserId de un usuario que ya no existe, también cae al fallback de Admin Total', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([{ id: 'a1', email: 'admin1@x.com' }]);
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alSuperarPresupuestoProyecto({
        tenantId: 't1',
        proyectoId: 'p1',
        proyectoNombre: 'Proyecto X',
        presupuesto: '10000',
        costoTotal: '12000',
        responsableUserId: 'u-borrado',
      });

      expect(prisma.user.findMany).toHaveBeenCalled();
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'proyecto_presupuesto_superado');
      expect(emailChannel.enviar).toHaveBeenCalledTimes(1);
    });
  });

  describe('alComentarTareaProyecto (Fase 8)', () => {
    beforeEach(() => {
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: 'x', cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);
      whatsAppChannel.enviar.mockResolvedValue(true);
    });

    it('no hace nada si no hay destinatarios (tarea sin responsables con User vinculado)', async () => {
      await service.alComentarTareaProyecto({
        tenantId: 't1',
        tareaId: 'ta1',
        tareaTitulo: 'Cotizar materiales',
        proyectoNombre: 'Proyecto X',
        autorNombre: 'Fulano',
        contenido: 'hola',
        destinatariosUserId: [],
      });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('envía EMAIL a cada destinatario', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'u1@x.com', telefono: null },
        { id: 'u2', email: 'u2@x.com', telefono: null },
      ]);

      await service.alComentarTareaProyecto({
        tenantId: 't1',
        tareaId: 'ta1',
        tareaTitulo: 'Cotizar materiales',
        proyectoNombre: 'Proyecto X',
        autorNombre: 'Fulano',
        contenido: 'hola equipo',
        destinatariosUserId: ['u1', 'u2'],
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { id: { in: ['u1', 'u2'] } } });
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'tarea_proyecto_comentario_nuevo');
      expect(emailChannel.enviar).toHaveBeenCalledTimes(2);
      expect(whatsAppChannel.enviar).not.toHaveBeenCalled();
    });

    it('además manda WHATSAPP solo a quien tiene teléfono guardado', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'u1@x.com', telefono: '18095551234' },
        { id: 'u2', email: 'u2@x.com', telefono: null },
      ]);

      await service.alComentarTareaProyecto({
        tenantId: 't1',
        tareaId: 'ta1',
        tareaTitulo: 'Cotizar materiales',
        proyectoNombre: 'Proyecto X',
        autorNombre: 'Fulano',
        contenido: 'hola equipo',
        destinatariosUserId: ['u1', 'u2'],
      });

      expect(emailChannel.enviar).toHaveBeenCalledTimes(2);
      expect(whatsAppChannel.enviar).toHaveBeenCalledTimes(1);
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'WHATSAPP', 'tarea_proyecto_comentario_nuevo');
    });
  });

  describe('alVencerTareaProyectoHoy', () => {
    beforeEach(() => {
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: 'x', cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);
      whatsAppChannel.enviar.mockResolvedValue(true);
    });

    it('no hace nada si no hay destinatarios', async () => {
      await service.alVencerTareaProyectoHoy({ tenantId: 't1', tareaId: 'tp1', tareaTitulo: 'Entregar diseño', proyectoNombre: 'Proyecto X', destinatariosUserId: [] });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('envía EMAIL siempre y WHATSAPP solo a quien tiene teléfono', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'u1@x.com', telefono: '18095551234' },
        { id: 'u2', email: 'u2@x.com', telefono: null },
      ]);

      await service.alVencerTareaProyectoHoy({ tenantId: 't1', tareaId: 'tp1', tareaTitulo: 'Entregar diseño', proyectoNombre: 'Proyecto X', destinatariosUserId: ['u1', 'u2'] });

      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'tarea_proyecto_vence_hoy');
      expect(emailChannel.enviar).toHaveBeenCalledTimes(2);
      expect(whatsAppChannel.enviar).toHaveBeenCalledTimes(1);
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'WHATSAPP', 'tarea_proyecto_vence_hoy');
    });
  });

  describe('alVencerTareaPersonalHoy', () => {
    beforeEach(() => {
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: 'x', cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);
      whatsAppChannel.enviar.mockResolvedValue(true);
    });

    it('no hace nada si el usuario ya no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await service.alVencerTareaPersonalHoy({ tenantId: 't1', tareaId: 'ta1', tareaTitulo: 'Backup mensual', usuarioId: 'u1' });
      expect(emailChannel.enviar).not.toHaveBeenCalled();
    });

    it('envía EMAIL siempre, y WHATSAPP solo si tiene teléfono guardado', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u1@x.com', telefono: '18095551234' });

      await service.alVencerTareaPersonalHoy({ tenantId: 't1', tareaId: 'ta1', tareaTitulo: 'Backup mensual', usuarioId: 'u1' });

      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'tarea_personal_vence_hoy');
      expect(emailChannel.enviar).toHaveBeenCalledTimes(1);
      expect(whatsAppChannel.enviar).toHaveBeenCalledTimes(1);
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'WHATSAPP', 'tarea_personal_vence_hoy');
    });

    it('sin teléfono guardado, solo manda EMAIL', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u1@x.com', telefono: null });

      await service.alVencerTareaPersonalHoy({ tenantId: 't1', tareaId: 'ta1', tareaTitulo: 'Backup mensual', usuarioId: 'u1' });

      expect(emailChannel.enviar).toHaveBeenCalledTimes(1);
      expect(whatsAppChannel.enviar).not.toHaveBeenCalled();
    });
  });

  describe('alQuedarPendienteAprobacionPublicacionSocial (Fase 5)', () => {
    it('resuelve destinatarios por el PERMISO publicacionessociales.aprobar, no por nombre de rol', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'gerente@x.com', telefono: null }]);
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alQuedarPendienteAprobacionPublicacionSocial({ tenantId: 't1', publicacionId: 'p1', productoNombre: 'Yogurt Fresa' });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 't1',
          activo: true,
          roles: { some: { role: { rolePermissions: { some: { permission: { clave: 'publicacionessociales.aprobar' } } } } } },
        },
      });
      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'publicacion_social_pendiente_aprobacion');
    });

    it('no intenta WhatsApp si el aprobador no tiene teléfono cargado', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'gerente@x.com', telefono: null }]);
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alQuedarPendienteAprobacionPublicacionSocial({ tenantId: 't1', publicacionId: 'p1', productoNombre: 'Yogurt Fresa' });

      expect(prisma.whatsappConfigTenant.findUnique).not.toHaveBeenCalled();
    });

    it('manda el WhatsApp del TENANT (Content API) cuando el aprobador tiene teléfono y hay Content SID configurado', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'gerente@x.com', telefono: '+18095551234' }]);
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);
      prisma.whatsappConfigTenant.findUnique.mockResolvedValue({
        twilioAccountSid: 'AC1',
        twilioAuthTokenCifrado: 'iv:tag:cifrado',
        twilioWhatsappFrom: '+15550001111',
        twilioTemplateAprobacionSid: 'HXabc123',
      } as never);
      const encriptado = await import('../common/utils/encriptado.util');
      jest.spyOn(encriptado, 'descifrar').mockReturnValue('token-real');
      const enviarSpy = jest.spyOn(twilioWhatsappUtil, 'enviarWhatsappTwilio').mockResolvedValue(true);

      await service.alQuedarPendienteAprobacionPublicacionSocial({ tenantId: 't1', publicacionId: 'p1', productoNombre: 'Yogurt Fresa' });

      expect(enviarSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          accountSid: 'AC1',
          from: 'whatsapp:+15550001111',
          to: '+18095551234',
          contentSid: 'HXabc123',
          contentVariables: expect.objectContaining({ '1': 'Yogurt Fresa' }),
        }),
      );
    });

    it('degrada en silencio (sin WhatsApp, sin romper) si el tenant no configuró el Content SID de aprobación', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'gerente@x.com', telefono: '+18095551234' }]);
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);
      prisma.whatsappConfigTenant.findUnique.mockResolvedValue({
        twilioAccountSid: 'AC1',
        twilioAuthTokenCifrado: 'iv:tag:cifrado',
        twilioWhatsappFrom: '+15550001111',
        twilioTemplateAprobacionSid: null,
      } as never);
      const enviarSpy = jest.spyOn(twilioWhatsappUtil, 'enviarWhatsappTwilio');

      await expect(
        service.alQuedarPendienteAprobacionPublicacionSocial({ tenantId: 't1', publicacionId: 'p1', productoNombre: 'Yogurt Fresa' }),
      ).resolves.not.toThrow();
      expect(enviarSpy).not.toHaveBeenCalled();
    });
  });

  describe('alPedirCambiosPublicacionSocial (Fase 5)', () => {
    it('avisa al creador con el comentario del aprobador', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'creador1', email: 'creador@x.com' });
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'Te pidieron: {{comentario}}' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alPedirCambiosPublicacionSocial({
        tenantId: 't1',
        publicacionId: 'p1',
        productoNombre: 'Yogurt Fresa',
        creadoPorId: 'creador1',
        comentario: 'cambiale el color a azul',
      });

      expect(emailChannel.enviar).toHaveBeenCalledWith('creador@x.com', '', 'Te pidieron: cambiale el color a azul', undefined, 't1');
    });

    it('no falla si el creador ya no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.alPedirCambiosPublicacionSocial({ tenantId: 't1', publicacionId: 'p1', productoNombre: 'Yogurt Fresa', creadoPorId: 'x', comentario: 'algo' }),
      ).resolves.not.toThrow();
      expect(repository.buscarPlantilla).not.toHaveBeenCalled();
    });
  });

  describe('alAprobarsePublicacionSocial / alRechazarsePublicacionSocial (Fase 5)', () => {
    it('avisa al creador cuando se aprueba', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'creador1', email: 'creador@x.com' });
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'x' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alAprobarsePublicacionSocial({ tenantId: 't1', publicacionId: 'p1', productoNombre: 'Yogurt Fresa', creadoPorId: 'creador1' });

      expect(repository.buscarPlantilla).toHaveBeenCalledWith('t1', 'EMAIL', 'publicacion_social_aprobada');
    });

    it('avisa al creador con el motivo cuando se rechaza', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'creador1', email: 'creador@x.com' });
      repository.buscarPlantilla.mockResolvedValue({ activa: true, asunto: null, cuerpo: 'Motivo: {{motivo_rechazo}}' } as never);
      repository.crearNotificacion.mockResolvedValue({ id: 'n1' } as never);
      emailChannel.enviar.mockResolvedValue(true);

      await service.alRechazarsePublicacionSocial({
        tenantId: 't1',
        publicacionId: 'p1',
        productoNombre: 'Yogurt Fresa',
        creadoPorId: 'creador1',
        motivoRechazo: 'La foto sale borrosa',
      });

      expect(emailChannel.enviar).toHaveBeenCalledWith('creador@x.com', '', 'Motivo: La foto sale borrosa', undefined, 't1');
    });
  });
});
