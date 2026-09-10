import { BadRequestException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsRepository } from './tenants.repository';

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: jest.Mocked<TenantsRepository>;

  beforeEach(() => {
    repository = {
      buscarPorId: jest.fn(),
      resetear: jest.fn(),
    } as unknown as jest.Mocked<TenantsRepository>;
    service = new TenantsService(repository);
  });

  describe('resetear', () => {
    it('rechaza si el subdominio tipeado no coincide con el del tenant (protección contra tenant equivocado)', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 't1', subdominio: 'ciguadr' } as never);

      await expect(service.resetear('t1', { modo: 'TRANSACCIONAL', confirmacionSubdominio: 'otro' })).rejects.toThrow(BadRequestException);
      expect(repository.resetear).not.toHaveBeenCalled();
    });

    it('ejecuta el reseteo si el subdominio tipeado coincide exactamente', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 't1', subdominio: 'ciguadr' } as never);
      repository.resetear.mockResolvedValue({ tenantId: 't1', modo: 'COMPLETO' } as never);

      const resultado = await service.resetear('t1', { modo: 'COMPLETO', confirmacionSubdominio: 'ciguadr' });

      expect(repository.resetear).toHaveBeenCalledWith('t1', 'COMPLETO');
      expect(resultado).toEqual({ tenantId: 't1', modo: 'COMPLETO' });
    });
  });
});
