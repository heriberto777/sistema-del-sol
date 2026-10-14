import { OportunidadesEventosService } from './oportunidades-eventos.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OportunidadesEventosService', () => {
  let service: OportunidadesEventosService;
  let prisma: {
    oportunidad: { findUnique: jest.Mock; update: jest.Mock };
    actividadCrm: { create: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      oportunidad: { findUnique: jest.fn(), update: jest.fn() },
      actividadCrm: { create: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    service = new OportunidadesEventosService(prisma as unknown as PrismaService);
  });

  describe('alResponderCotizacion', () => {
    it('no hace nada si la cotización no está vinculada a ninguna oportunidad', async () => {
      prisma.oportunidad.findUnique.mockResolvedValue(null);

      await service.alResponderCotizacion({ tenantId: 't1', cotizacionId: 'c1', vendedorId: 'v1', clienteNombre: 'Ana', numero: 'COT-1', decision: 'ACEPTADA' });

      expect(prisma.actividadCrm.createMany).not.toHaveBeenCalled();
      expect(prisma.oportunidad.update).not.toHaveBeenCalled();
    });

    it('no hace nada si la oportunidad vinculada ya no está ABIERTA', async () => {
      prisma.oportunidad.findUnique.mockResolvedValue({ id: 'op-1', estado: 'GANADA' });

      await service.alResponderCotizacion({ tenantId: 't1', cotizacionId: 'c1', vendedorId: 'v1', clienteNombre: 'Ana', numero: 'COT-1', decision: 'RECHAZADA' });

      expect(prisma.oportunidad.update).not.toHaveBeenCalled();
    });

    it('ACEPTADA: crea una NOTA y una TAREA para el vendedor, sin tocar el estado de la oportunidad', async () => {
      prisma.oportunidad.findUnique.mockResolvedValue({ id: 'op-1', estado: 'ABIERTA' });

      await service.alResponderCotizacion({ tenantId: 't1', cotizacionId: 'c1', vendedorId: 'v1', clienteNombre: 'Ana', numero: 'COT-1', decision: 'ACEPTADA' });

      expect(prisma.actividadCrm.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ tipo: 'NOTA', oportunidadId: 'op-1', usuarioId: 'v1', completada: true }),
          expect.objectContaining({ tipo: 'TAREA', oportunidadId: 'op-1', usuarioId: 'v1' }),
        ],
      });
      expect(prisma.oportunidad.update).not.toHaveBeenCalled();
    });

    it('RECHAZADA: marca la oportunidad PERDIDA con el motivo y registra una NOTA', async () => {
      prisma.oportunidad.findUnique.mockResolvedValue({ id: 'op-1', estado: 'ABIERTA' });

      await service.alResponderCotizacion({
        tenantId: 't1',
        cotizacionId: 'c1',
        vendedorId: 'v1',
        clienteNombre: 'Ana',
        numero: 'COT-1',
        decision: 'RECHAZADA',
        motivo: 'Precio muy alto',
      });

      expect(prisma.oportunidad.update).toHaveBeenCalledWith({
        where: { id: 'op-1' },
        data: expect.objectContaining({ estado: 'PERDIDA', motivoPerdida: 'Precio muy alto' }),
      });
      expect(prisma.actividadCrm.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tipo: 'NOTA', descripcion: expect.stringContaining('Precio muy alto') }),
      });
    });
  });

  describe('alConvertirseEnFactura', () => {
    it('no hace nada si no hay oportunidad vinculada', async () => {
      prisma.oportunidad.findUnique.mockResolvedValue(null);

      await service.alConvertirseEnFactura({ tenantId: 't1', cotizacionId: 'c1', facturaId: 'f1' });

      expect(prisma.oportunidad.update).not.toHaveBeenCalled();
    });

    it('marca GANADA la oportunidad vinculada si sigue ABIERTA', async () => {
      prisma.oportunidad.findUnique.mockResolvedValue({ id: 'op-1', estado: 'ABIERTA' });

      await service.alConvertirseEnFactura({ tenantId: 't1', cotizacionId: 'c1', facturaId: 'f1' });

      expect(prisma.oportunidad.update).toHaveBeenCalledWith({ where: { id: 'op-1' }, data: expect.objectContaining({ estado: 'GANADA' }) });
    });

    it('no vuelve a tocar una oportunidad que ya estaba GANADA/PERDIDA', async () => {
      prisma.oportunidad.findUnique.mockResolvedValue({ id: 'op-1', estado: 'PERDIDA' });

      await service.alConvertirseEnFactura({ tenantId: 't1', cotizacionId: 'c1', facturaId: 'f1' });

      expect(prisma.oportunidad.update).not.toHaveBeenCalled();
    });
  });
});
