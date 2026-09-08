import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PublicacionesSocialesService } from './publicaciones-sociales.service';
import { PublicacionesSocialesRepository } from './publicaciones-sociales.repository';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';

describe('PublicacionesSocialesService', () => {
  let service: PublicacionesSocialesService;
  let repo: jest.Mocked<PublicacionesSocialesRepository>;
  let whatsappConfigRepository: jest.Mocked<WhatsappConfigRepository>;

  beforeEach(() => {
    repo = {
      crear: jest.fn(),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      actualizarEstado: jest.fn(),
      buscarProductoParaGenerar: jest.fn(),
      buscarPlantillaPorId: jest.fn(),
      listarPlantillasActivas: jest.fn(),
    } as unknown as jest.Mocked<PublicacionesSocialesRepository>;
    whatsappConfigRepository = { obtenerOCrear: jest.fn(), actualizar: jest.fn() } as unknown as jest.Mocked<WhatsappConfigRepository>;
    const prisma = {} as PrismaService;
    service = new PublicacionesSocialesService(repo, prisma, whatsappConfigRepository);
  });

  describe('enviarAAprobacion', () => {
    it('pasa de BORRADOR a PENDIENTE_APROBACION', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'BORRADOR' } as never);
      repo.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await service.enviarAAprobacion('p1');

      expect(repo.actualizarEstado).toHaveBeenCalledWith('p1', { estado: 'PENDIENTE_APROBACION' });
    });

    it('rechaza si la publicación no está en BORRADOR', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.enviarAAprobacion('p1')).rejects.toThrow(BadRequestException);
      expect(repo.actualizarEstado).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstado', () => {
    it('aprueba una publicación PENDIENTE_APROBACION', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);
      repo.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'APROBADA' } as never);

      await service.cambiarEstado('p1', 'APROBADA', 'u1');

      expect(repo.actualizarEstado).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ estado: 'APROBADA', aprobadoPorId: 'u1' }),
      );
    });

    it('rechaza con motivo obligatorio', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.cambiarEstado('p1', 'RECHAZADA', 'u1')).rejects.toThrow(BadRequestException);
      expect(repo.actualizarEstado).not.toHaveBeenCalled();
    });

    it('rechaza con motivo en blanco igual que sin motivo', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.cambiarEstado('p1', 'RECHAZADA', 'u1', '   ')).rejects.toThrow(BadRequestException);
    });

    it('acepta un rechazo con motivo real', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);
      repo.actualizarEstado.mockResolvedValue({ id: 'p1', estado: 'RECHAZADA' } as never);

      await service.cambiarEstado('p1', 'RECHAZADA', 'u1', 'La foto sale borrosa');

      expect(repo.actualizarEstado).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ estado: 'RECHAZADA', motivoRechazo: 'La foto sale borrosa' }),
      );
    });

    it('no permite aprobar/rechazar una publicación que no está PENDIENTE_APROBACION', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'BORRADOR' } as never);

      await expect(service.cambiarEstado('p1', 'APROBADA', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('enviarPorWhatsapp', () => {
    it('rechaza si la publicación no está APROBADA', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'PENDIENTE_APROBACION' } as never);

      await expect(service.enviarPorWhatsapp('p1', '+18095551234', 't1')).rejects.toThrow(BadRequestException);
      expect(whatsappConfigRepository.obtenerOCrear).not.toHaveBeenCalled();
    });

    it('degrada con un error claro si el tenant no configuró Twilio', async () => {
      repo.buscarPorId.mockResolvedValue({ id: 'p1', estado: 'APROBADA', producto: { nombre: 'Yogurt Fresa' } } as never);
      whatsappConfigRepository.obtenerOCrear.mockResolvedValue({} as never);

      await expect(service.enviarPorWhatsapp('p1', '+18095551234', 't1')).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
