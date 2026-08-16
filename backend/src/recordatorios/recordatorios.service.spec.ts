import { RecordatoriosService } from './recordatorios.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

describe('RecordatoriosService', () => {
  let service: RecordatoriosService;
  let prisma: { factura: { findMany: jest.Mock } };
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
    prisma = { factura: { findMany: jest.fn() } };
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

  it('solo consulta facturas EMITIDA, CREDITO y no pagadas', async () => {
    prisma.factura.findMany.mockResolvedValue([]);

    await service.enviarRecordatoriosDeCobro();

    expect(prisma.factura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: 'EMITIDA', tipoFactura: 'CREDITO', pagada: false } }),
    );
  });
});
