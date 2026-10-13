import { BadRequestException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';

describe('LeadsService', () => {
  let repository: jest.Mocked<LeadsRepository>;
  let service: LeadsService;

  beforeEach(() => {
    repository = {
      crear: jest.fn().mockResolvedValue({ id: 'lead-1' }),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      cambiarEstado: jest.fn(),
      validarVendedorDelTenant: jest.fn().mockResolvedValue({ id: 'user-2' }),
    } as unknown as jest.Mocked<LeadsRepository>;
    service = new LeadsService(repository);
  });

  describe('crear', () => {
    it('asigna el lead al usuario actual si no se especifica vendedorId', async () => {
      await service.crear({ nombre: 'Juan Pérez' }, 'tenant-1', 'user-1');

      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ vendedorId: 'user-1', tenantId: 'tenant-1' }));
      expect(repository.validarVendedorDelTenant).not.toHaveBeenCalled();
    });

    it('valida el vendedorId contra el tenant cuando se especifica explícito', async () => {
      await service.crear({ nombre: 'Juan Pérez', vendedorId: 'user-2' }, 'tenant-1', 'user-1');

      expect(repository.validarVendedorDelTenant).toHaveBeenCalledWith('user-2');
      expect(repository.crear).toHaveBeenCalledWith(expect.objectContaining({ vendedorId: 'user-2' }));
    });
  });

  describe('actualizar', () => {
    it('rechaza editar un lead ya convertido', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'lead-1', estado: 'CONVERTIDO' } as never);

      await expect(service.actualizar('lead-1', { nombre: 'x' })).rejects.toThrow(BadRequestException);
      expect(repository.actualizar).not.toHaveBeenCalled();
    });
  });

  describe('cambiarEstado', () => {
    it('rechaza cambiar el estado de un lead ya convertido', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'lead-1', estado: 'CONVERTIDO' } as never);

      await expect(service.cambiarEstado('lead-1', { estado: 'CONTACTADO' })).rejects.toThrow(BadRequestException);
    });

    it('exige motivoDescarte al pasar a DESCARTADO', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'lead-1', estado: 'NUEVO' } as never);

      await expect(service.cambiarEstado('lead-1', { estado: 'DESCARTADO' })).rejects.toThrow(BadRequestException);
      expect(repository.cambiarEstado).not.toHaveBeenCalled();
    });

    it('permite revivir un lead descartado hacia CONTACTADO (puede cambiar de opinión, mismo criterio que Cotizaciones rechazadas)', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'lead-1', estado: 'DESCARTADO' } as never);

      await service.cambiarEstado('lead-1', { estado: 'CONTACTADO' });

      expect(repository.cambiarEstado).toHaveBeenCalledWith('lead-1', 'CONTACTADO', null);
    });
  });
});
