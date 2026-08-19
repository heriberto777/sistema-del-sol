import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AtributosService } from './atributos.service';
import { AtributosRepository } from './atributos.repository';

describe('AtributosService', () => {
  let service: AtributosService;
  let repository: jest.Mocked<AtributosRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      crearValor: jest.fn(),
      eliminarValor: jest.fn(),
      eliminarAtributo: jest.fn(),
    } as unknown as jest.Mocked<AtributosRepository>;
    service = new AtributosService(repository);
  });

  describe('crear', () => {
    it('crea el atributo con el tenantId del caller', async () => {
      await service.crear('Talla', 'tenant-1');

      expect(repository.crear).toHaveBeenCalledWith('Talla', 'tenant-1');
    });
  });

  describe('crearValor', () => {
    it('valida que el atributo pertenezca al tenant antes de crear el valor', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'a1', valores: [] } as never);

      await service.crearValor('a1', 'M');

      expect(repository.buscarPorId).toHaveBeenCalledWith('a1');
      expect(repository.crearValor).toHaveBeenCalledWith('a1', 'M');
    });
  });

  describe('eliminarValor', () => {
    it('rechaza (404) si el valor no pertenece al atributo indicado', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'a1', valores: [{ id: 'v-otro', valor: 'L', _count: { variantes: 0 } }] } as never);

      await expect(service.eliminarValor('a1', 'v1')).rejects.toThrow(NotFoundException);
      expect(repository.eliminarValor).not.toHaveBeenCalled();
    });

    it('rechaza (400) si el valor está en uso por alguna variante', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'a1', valores: [{ id: 'v1', valor: 'M', _count: { variantes: 2 } }] } as never);

      await expect(service.eliminarValor('a1', 'v1')).rejects.toThrow(BadRequestException);
      expect(repository.eliminarValor).not.toHaveBeenCalled();
    });

    it('elimina el valor cuando pertenece al atributo y no está en uso', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'a1', valores: [{ id: 'v1', valor: 'M', _count: { variantes: 0 } }] } as never);

      await service.eliminarValor('a1', 'v1');

      expect(repository.eliminarValor).toHaveBeenCalledWith('v1');
    });
  });

  describe('eliminarAtributo', () => {
    it('rechaza si alguno de sus valores está en uso', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'a1',
        valores: [
          { id: 'v1', valor: 'M', _count: { variantes: 0 } },
          { id: 'v2', valor: 'L', _count: { variantes: 1 } },
        ],
      } as never);

      await expect(service.eliminarAtributo('a1')).rejects.toThrow(BadRequestException);
      expect(repository.eliminarAtributo).not.toHaveBeenCalled();
    });

    it('elimina el atributo cuando ningún valor está en uso', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'a1',
        valores: [{ id: 'v1', valor: 'M', _count: { variantes: 0 } }],
      } as never);

      await service.eliminarAtributo('a1');

      expect(repository.eliminarAtributo).toHaveBeenCalledWith('a1');
    });
  });
});
