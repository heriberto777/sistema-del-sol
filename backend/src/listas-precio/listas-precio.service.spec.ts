import { BadRequestException } from '@nestjs/common';
import { ListasPrecioService } from './listas-precio.service';
import { ListasPrecioRepository } from './listas-precio.repository';

describe('ListasPrecioService', () => {
  let service: ListasPrecioService;
  let repository: jest.Mocked<ListasPrecioRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
    } as unknown as jest.Mocked<ListasPrecioRepository>;
    service = new ListasPrecioService(repository);
  });

  describe('actualizar', () => {
    it('rechaza renombrar la lista GENERAL', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'lp-1', nombre: 'GENERAL', activa: true } as never);

      await expect(service.actualizar('lp-1', { nombre: 'General renombrada' })).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });

    it('permite desactivar GENERAL sin tocar el nombre', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'lp-1', nombre: 'GENERAL', activa: true } as never);

      await service.actualizar('lp-1', { activa: false });

      expect(repository.actualizar).toHaveBeenCalledWith('lp-1', { activa: false });
    });

    it('permite renombrar una lista que no es GENERAL', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'lp-2', nombre: 'Mayorista', activa: true } as never);

      await service.actualizar('lp-2', { nombre: 'Mayorista VIP' });

      expect(repository.actualizar).toHaveBeenCalledWith('lp-2', { nombre: 'Mayorista VIP' });
    });

    it('no consulta la lista existente si el update no toca nombre', async () => {
      await service.actualizar('lp-2', { activa: false });

      expect(repository.buscarPorId).not.toHaveBeenCalled();
      expect(repository.actualizar).toHaveBeenCalledWith('lp-2', { activa: false });
    });
  });
});
