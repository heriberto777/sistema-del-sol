import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentosPublicosService } from './documentos-publicos.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';

const COTIZACION_BASE = {
  id: 'c1',
  tenantId: 't1',
  numero: 'COT-1',
  vendedorId: 'v1',
  estado: 'ENVIADA',
  motivoRechazo: null,
  cliente: { nombre: 'Ana' },
  lineas: [],
};

describe('DocumentosPublicosService.responderCotizacion (CRM "Cotización conectada")', () => {
  let service: DocumentosPublicosService;
  let prisma: { cotizacion: { findUnique: jest.Mock; update: jest.Mock } };
  let eventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    prisma = { cotizacion: { findUnique: jest.fn(), update: jest.fn() } };
    eventBus = { emit: jest.fn(), on: jest.fn() } as unknown as jest.Mocked<EventBusService>;
    service = new DocumentosPublicosService(prisma as unknown as PrismaService, eventBus);
  });

  it('404 si la cotización no existe', async () => {
    prisma.cotizacion.findUnique.mockResolvedValue(null);

    await expect(service.responderCotizacion('c1', { decision: 'ACEPTADA' })).rejects.toThrow(NotFoundException);
  });

  it('rechaza responder si ya está ACEPTADA — el único estado realmente cerrado', async () => {
    prisma.cotizacion.findUnique.mockResolvedValue({ ...COTIZACION_BASE, estado: 'ACEPTADA' });

    await expect(service.responderCotizacion('c1', { decision: 'RECHAZADA', motivo: 'x' })).rejects.toThrow(BadRequestException);
    expect(prisma.cotizacion.update).not.toHaveBeenCalled();
  });

  it('exige motivo al rechazar', async () => {
    prisma.cotizacion.findUnique.mockResolvedValue(COTIZACION_BASE);

    await expect(service.responderCotizacion('c1', { decision: 'RECHAZADA' })).rejects.toThrow(BadRequestException);
    expect(prisma.cotizacion.update).not.toHaveBeenCalled();
  });

  it('ACEPTADA: actualiza el estado y emite COTIZACION_RESPONDIDA sin motivo', async () => {
    prisma.cotizacion.findUnique.mockResolvedValue(COTIZACION_BASE);

    const resultado = await service.responderCotizacion('c1', { decision: 'ACEPTADA' });

    expect(prisma.cotizacion.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { estado: 'ACEPTADA', motivoRechazo: null } });
    expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.COTIZACION_RESPONDIDA, {
      tenantId: 't1',
      cotizacionId: 'c1',
      vendedorId: 'v1',
      clienteNombre: 'Ana',
      numero: 'COT-1',
      decision: 'ACEPTADA',
      motivo: undefined,
    });
    expect(resultado).toEqual({ ok: true, estado: 'ACEPTADA' });
  });

  it('RECHAZADA: guarda el motivo y lo manda en el evento', async () => {
    prisma.cotizacion.findUnique.mockResolvedValue(COTIZACION_BASE);

    await service.responderCotizacion('c1', { decision: 'RECHAZADA', motivo: '  Precio muy alto  ' });

    expect(prisma.cotizacion.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { estado: 'RECHAZADA', motivoRechazo: 'Precio muy alto' } });
    expect(eventBus.emit).toHaveBeenCalledWith(EVENTOS.COTIZACION_RESPONDIDA, expect.objectContaining({ decision: 'RECHAZADA', motivo: 'Precio muy alto' }));
  });

  it('permite responder de nuevo una cotización ya RECHAZADA (puede cambiar de opinión y aprobar)', async () => {
    prisma.cotizacion.findUnique.mockResolvedValue({ ...COTIZACION_BASE, estado: 'RECHAZADA' });

    await service.responderCotizacion('c1', { decision: 'ACEPTADA' });

    expect(prisma.cotizacion.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { estado: 'ACEPTADA', motivoRechazo: null } });
  });
});
