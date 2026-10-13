import { BadRequestException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';
import { ClientesService } from '../clientes/clientes.service';

describe('LeadsService', () => {
  let repository: jest.Mocked<LeadsRepository>;
  let clientesService: jest.Mocked<ClientesService>;
  let service: LeadsService;

  beforeEach(() => {
    repository = {
      crear: jest.fn().mockResolvedValue({ id: 'lead-1' }),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      cambiarEstado: jest.fn(),
      marcarConvertido: jest.fn(),
      validarVendedorDelTenant: jest.fn().mockResolvedValue({ id: 'user-2' }),
    } as unknown as jest.Mocked<LeadsRepository>;
    clientesService = { crear: jest.fn().mockResolvedValue({ id: 'cliente-nuevo' }) } as unknown as jest.Mocked<ClientesService>;
    service = new LeadsService(repository, clientesService);
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

  describe('convertir (Fase 2)', () => {
    it('crea el cliente heredando nombre/email/telefono del lead y marca el lead como CONVERTIDO', async () => {
      repository.buscarPorId.mockResolvedValue({
        id: 'lead-1',
        estado: 'CALIFICADO',
        nombre: 'Ferretería Pérez',
        email: 'ferreteria@ejemplo.com',
        telefono: '8095551111',
      } as never);

      const cliente = await service.convertir('lead-1', { tipo: 'PERSONA_JURIDICA', rncCedula: '101-1' }, 'tenant-1');

      expect(clientesService.crear).toHaveBeenCalledWith(
        { nombre: 'Ferretería Pérez', email: 'ferreteria@ejemplo.com', telefono: '8095551111', tipo: 'PERSONA_JURIDICA', rncCedula: '101-1' },
        'tenant-1',
      );
      expect(repository.marcarConvertido).toHaveBeenCalledWith('lead-1', 'cliente-nuevo');
      expect(cliente).toEqual({ id: 'cliente-nuevo' });
    });

    it('rechaza convertir un lead ya convertido', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'lead-1', estado: 'CONVERTIDO' } as never);

      await expect(service.convertir('lead-1', {}, 'tenant-1')).rejects.toThrow(BadRequestException);
      expect(clientesService.crear).not.toHaveBeenCalled();
    });
  });
});
