import { RecordatoriosService } from './recordatorios.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

describe('RecordatoriosService', () => {
  let service: RecordatoriosService;
  let prisma: {
    factura: { findMany: jest.Mock; findUnique: jest.Mock };
    cotizacion: { findUnique: jest.Mock };
    comentarioDocumento: { findMany: jest.Mock; update: jest.Mock };
  };
  let notificacionesService: jest.Mocked<NotificacionesService>;

  const DIA_MS = 24 * 60 * 60 * 1000;

  function factura(overrides: Record<string, unknown> = {}) {
    return {
      id: 'f1',
      tenantId: 't1',
      ncf: 'B0100000001',
      total: 500,
      fecha: new Date(Date.now() - 40 * DIA_MS),
      plazoPagoDias: 30,
      cliente: { nombre: 'Cliente X', email: 'x@y.com', telefono: '+18095551234' },
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      factura: { findMany: jest.fn(), findUnique: jest.fn() },
      cotizacion: { findUnique: jest.fn() },
      comentarioDocumento: { findMany: jest.fn(), update: jest.fn() },
    };
    notificacionesService = { enviar: jest.fn() } as unknown as jest.Mocked<NotificacionesService>;
    service = new RecordatoriosService(prisma as unknown as PrismaService, notificacionesService);
  });

  it('envía recordatorio por email y WhatsApp a una factura vencida con ambos datos', async () => {
    prisma.factura.findMany.mockResolvedValue([factura()]);

    const cantidad = await service.enviarRecordatoriosDeCobro();

    expect(cantidad).toBe(1);
    expect(notificacionesService.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', canal: 'EMAIL', clave: 'factura_vencida', destinatario: 'x@y.com' }),
    );
    expect(notificacionesService.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', canal: 'WHATSAPP', clave: 'factura_vencida', destinatario: '+18095551234' }),
    );
  });

  it('no envía nada si la factura todavía está dentro del plazo de pago', async () => {
    prisma.factura.findMany.mockResolvedValue([
      factura({ fecha: new Date(Date.now() - 10 * DIA_MS), plazoPagoDias: 30 }),
    ]);

    const cantidad = await service.enviarRecordatoriosDeCobro();

    expect(cantidad).toBe(0);
    expect(notificacionesService.enviar).not.toHaveBeenCalled();
  });

  it('respeta el plazoPagoDias de cada factura individualmente', async () => {
    prisma.factura.findMany.mockResolvedValue([
      factura({ id: 'f-corto', fecha: new Date(Date.now() - 8 * DIA_MS), plazoPagoDias: 5 }), // vencida
      factura({ id: 'f-largo', fecha: new Date(Date.now() - 8 * DIA_MS), plazoPagoDias: 60 }), // no vencida
    ]);

    const cantidad = await service.enviarRecordatoriosDeCobro();

    expect(cantidad).toBe(1);
  });

  it('no intenta WhatsApp si el cliente no tiene teléfono', async () => {
    prisma.factura.findMany.mockResolvedValue([factura({ cliente: { nombre: 'X', email: 'x@y.com', telefono: null } })]);

    await service.enviarRecordatoriosDeCobro();

    expect(notificacionesService.enviar).toHaveBeenCalledTimes(1);
    expect(notificacionesService.enviar).toHaveBeenCalledWith(expect.objectContaining({ canal: 'EMAIL' }));
  });

  it('respeta el opt-out de canal del cliente (notificaciones*Habilitadas === false)', async () => {
    prisma.factura.findMany.mockResolvedValue([
      factura({ cliente: { nombre: 'X', email: 'x@y.com', telefono: '+18095551234', notificacionesEmailHabilitadas: false } }),
    ]);

    await service.enviarRecordatoriosDeCobro();

    expect(notificacionesService.enviar).toHaveBeenCalledTimes(1);
    expect(notificacionesService.enviar).toHaveBeenCalledWith(expect.objectContaining({ canal: 'WHATSAPP' }));
  });

  it('solo consulta facturas EMITIDA, CREDITO y no pagadas', async () => {
    prisma.factura.findMany.mockResolvedValue([]);

    await service.enviarRecordatoriosDeCobro();

    expect(prisma.factura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: 'EMITIDA', tipoFactura: 'CREDITO', pagada: false } }),
    );
  });

  describe('enviarRecordatoriosDeComentarios', () => {
    function comentario(overrides: Record<string, unknown> = {}) {
      return {
        id: 'c1',
        tenantId: 't1',
        tipoDocumento: 'FACTURA',
        documentoId: 'factura-1',
        texto: 'Llamar al cliente por el pago',
        autor: { email: 'autor@demo.com', telefono: null },
        mencionado: null,
        ...overrides,
      };
    }

    it('avisa al MENCIONADO (no al autor) cuando el comentario tiene una mención', async () => {
      prisma.comentarioDocumento.findMany.mockResolvedValue([
        comentario({ mencionado: { email: 'mencionado@demo.com', telefono: '+18095550000' } }),
      ]);
      prisma.factura.findUnique.mockResolvedValue({ ncf: 'B0200000010' });

      await service.enviarRecordatoriosDeComentarios();

      expect(notificacionesService.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ canal: 'EMAIL', clave: 'comentario_documento_recordatorio', destinatario: 'mencionado@demo.com' }),
      );
      expect(notificacionesService.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ canal: 'WHATSAPP', clave: 'comentario_documento_recordatorio', destinatario: '+18095550000' }),
      );
    });

    it('sin mención (recordatorio personal): avisa al propio AUTOR', async () => {
      prisma.comentarioDocumento.findMany.mockResolvedValue([comentario()]);
      prisma.factura.findUnique.mockResolvedValue({ ncf: 'B0200000010' });

      await service.enviarRecordatoriosDeComentarios();

      expect(notificacionesService.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ canal: 'EMAIL', clave: 'comentario_documento_recordatorio', destinatario: 'autor@demo.com' }),
      );
      // Sin WhatsApp — el autor de este fixture no tiene teléfono.
      expect(notificacionesService.enviar).toHaveBeenCalledTimes(1);
    });

    it('resuelve la etiqueta contra Cotizacion.numero cuando tipoDocumento es COTIZACION', async () => {
      prisma.comentarioDocumento.findMany.mockResolvedValue([comentario({ tipoDocumento: 'COTIZACION', documentoId: 'cot-1' })]);
      prisma.cotizacion.findUnique.mockResolvedValue({ numero: 'COT-00042' });

      await service.enviarRecordatoriosDeComentarios();

      expect(prisma.factura.findUnique).not.toHaveBeenCalled();
      expect(notificacionesService.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ variables: expect.objectContaining({ tipo_documento_etiqueta: 'Cotización', documento_etiqueta: 'COT-00042' }) }),
      );
    });

    it('marca recordatorioEnviado=true después de notificar, para no repetir mañana', async () => {
      prisma.comentarioDocumento.findMany.mockResolvedValue([comentario()]);
      prisma.factura.findUnique.mockResolvedValue({ ncf: 'B0200000010' });

      await service.enviarRecordatoriosDeComentarios();

      expect(prisma.comentarioDocumento.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { recordatorioEnviado: true } });
    });

    it('solo busca los que tienen recordatorioEnviado=false y fechaRecordatorio ya vencida', async () => {
      prisma.comentarioDocumento.findMany.mockResolvedValue([]);

      await service.enviarRecordatoriosDeComentarios();

      expect(prisma.comentarioDocumento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ recordatorioEnviado: false, fechaRecordatorio: expect.objectContaining({ lte: expect.any(Date) }) }) }),
      );
    });
  });
});
