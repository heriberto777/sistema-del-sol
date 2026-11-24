import { BadRequestException } from '@nestjs/common';
import { ReportesTenantService } from './reportes-tenant.service';
import { ReportesTenantRepository } from './reportes-tenant.repository';

const DOC_VALIDO = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hola' }] }] };

describe('ReportesTenantService', () => {
  let service: ReportesTenantService;
  let repository: jest.Mocked<ReportesTenantRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listarPropios: jest.fn(),
      buscarPorIdOrThrow: jest.fn(),
      listarMensajes: jest.fn(),
      agregarMensaje: jest.fn(),
    } as unknown as jest.Mocked<ReportesTenantRepository>;
    service = new ReportesTenantService(repository);
  });

  describe('crear', () => {
    it('rechaza un cuerpo con nodos fuera de la lista blanca de Tiptap', () => {
      const dto = { asunto: 'Algo', categoria: 'DUDA', cuerpo: { type: 'doc', content: [{ type: 'codeBlock', content: [] }] } } as never;
      expect(() => service.crear(dto, 'tenant-1', 'user-1')).toThrow(BadRequestException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('crea el reporte cuando el cuerpo es válido', async () => {
      const dto = { asunto: 'Algo', categoria: 'DUDA', cuerpo: DOC_VALIDO } as never;
      repository.crear.mockResolvedValue({ id: 'r1' } as never);
      await service.crear(dto, 'tenant-1', 'user-1');
      expect(repository.crear).toHaveBeenCalledWith(dto, 'tenant-1', 'user-1');
    });
  });

  describe('agregarMensaje', () => {
    it('reabre el ticket (EN_REVISION) si el tenant responde uno ya RESUELTO', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({ id: 'r1', estado: 'RESUELTO' } as never);
      const dto = { cuerpo: DOC_VALIDO } as never;

      await service.agregarMensaje('r1', dto, 'user-1');

      expect(repository.agregarMensaje).toHaveBeenCalledWith('r1', dto, 'user-1', 'EN_REVISION');
    });

    it('no toca el estado si el ticket no estaba RESUELTO', async () => {
      repository.buscarPorIdOrThrow.mockResolvedValue({ id: 'r1', estado: 'EN_REVISION' } as never);
      const dto = { cuerpo: DOC_VALIDO } as never;

      await service.agregarMensaje('r1', dto, 'user-1');

      expect(repository.agregarMensaje).toHaveBeenCalledWith('r1', dto, 'user-1', undefined);
    });

    it('rechaza un mensaje con cuerpo inválido antes de tocar el repositorio', async () => {
      const dto = { cuerpo: { type: 'doc', content: [{ type: 'image' }] } } as never;
      await expect(service.agregarMensaje('r1', dto, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.buscarPorIdOrThrow).not.toHaveBeenCalled();
    });
  });
});
