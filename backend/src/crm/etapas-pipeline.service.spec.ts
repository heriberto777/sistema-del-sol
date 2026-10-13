import { BadRequestException } from '@nestjs/common';
import { EtapasPipelineService } from './etapas-pipeline.service';
import { EtapasPipelineRepository } from './etapas-pipeline.repository';

describe('EtapasPipelineService', () => {
  let repository: jest.Mocked<EtapasPipelineRepository>;
  let service: EtapasPipelineService;

  beforeEach(() => {
    repository = {
      contar: jest.fn(),
      crear: jest.fn(),
      crearVarias: jest.fn().mockResolvedValue({ count: 4 }),
      listar: jest.fn().mockResolvedValue([{ id: 'etapa-1' }]),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(),
    } as unknown as jest.Mocked<EtapasPipelineRepository>;
    service = new EtapasPipelineService(repository);
  });

  describe('obtenerOSembrar', () => {
    it('siembra las 4 etapas default si el tenant no tiene ninguna todavía', async () => {
      repository.contar.mockResolvedValue(0);

      await service.obtenerOSembrar('tenant-1');

      expect(repository.crearVarias).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ nombre: 'Prospección', tenantId: 'tenant-1' })]),
      );
      expect(repository.crearVarias.mock.calls[0][0]).toHaveLength(4);
    });

    it('no siembra nada si el tenant ya tiene etapas configuradas', async () => {
      repository.contar.mockResolvedValue(3);

      await service.obtenerOSembrar('tenant-1');

      expect(repository.crearVarias).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('convierte el error de FK (etapa con oportunidades) en un mensaje claro', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'etapa-1' } as never);
      repository.eliminar.mockRejectedValue(new Error('foreign key violation'));

      await expect(service.eliminar('etapa-1')).rejects.toThrow(BadRequestException);
    });
  });
});
