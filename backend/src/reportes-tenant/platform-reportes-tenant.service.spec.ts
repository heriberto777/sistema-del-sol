import { BadRequestException } from '@nestjs/common';
import { PlatformReportesTenantService } from './platform-reportes-tenant.service';
import { PlatformReportesTenantRepository } from './platform-reportes-tenant.repository';

const DOC_VALIDO = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hola', marks: [{ type: 'bold' }] }] }] };

describe('PlatformReportesTenantService', () => {
  let service: PlatformReportesTenantService;
  let repository: jest.Mocked<PlatformReportesTenantRepository>;

  beforeEach(() => {
    repository = {
      listar: jest.fn(),
      buscarPorIdOrThrow: jest.fn(),
      listarMensajes: jest.fn(),
      agregarMensaje: jest.fn(),
      cambiarEstado: jest.fn(),
      contarNuevos: jest.fn(),
    } as unknown as jest.Mocked<PlatformReportesTenantRepository>;
    service = new PlatformReportesTenantService(repository);
  });

  describe('agregarMensaje', () => {
    it('pasa el ticket de NUEVO a EN_REVISION en la primera respuesta del equipo', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({ id: 'r1', estado: 'NUEVO' } as never);
      const dto = { cuerpo: DOC_VALIDO } as never;

      await service.agregarMensaje('r1', dto, 'admin-1');

      expect(repository.agregarMensaje).toHaveBeenCalledWith('r1', dto, 'admin-1', 'EN_REVISION');
    });

    it('no toca el estado si ya estaba EN_REVISION o RESUELTO', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({ id: 'r1', estado: 'RESUELTO' } as never);
      const dto = { cuerpo: DOC_VALIDO } as never;

      await service.agregarMensaje('r1', dto, 'admin-1');

      expect(repository.agregarMensaje).toHaveBeenCalledWith('r1', dto, 'admin-1', undefined);
    });

    it('rechaza un mensaje con marca fuera de la lista blanca', async () => {
      const dto = { cuerpo: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'underline' }] }] }] } } as never;
      await expect(service.agregarMensaje('r1', dto, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cambiarEstado', () => {
    it('delega directo en el repositorio', async () => {
      const dto = { estado: 'RESUELTO' } as never;
      await service.cambiarEstado('r1', dto);
      expect(repository.cambiarEstado).toHaveBeenCalledWith('r1', 'RESUELTO');
    });
  });
});
