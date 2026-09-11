import { ForbiddenException } from '@nestjs/common';
import { TareasPersonalesService } from './tareas-personales.service';
import { TareasPersonalesRepository } from './tareas-personales.repository';

describe('TareasPersonalesService', () => {
  let service: TareasPersonalesService;
  let repository: jest.Mocked<TareasPersonalesRepository>;

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      actualizar: jest.fn(),
      eliminar: jest.fn(),
      crearComentario: jest.fn(),
      buscarComentarioPorId: jest.fn(),
      eliminarComentario: jest.fn(),
    } as unknown as jest.Mocked<TareasPersonalesRepository>;
    service = new TareasPersonalesService(repository);
  });

  describe('crear', () => {
    it('crea la tarea para el usuario y tenant actuales', async () => {
      await service.crear({ titulo: 'Llamar al proveedor' }, 'u1', 't1');
      expect(repository.crear).toHaveBeenCalledWith({ titulo: 'Llamar al proveedor' }, 'u1', 't1');
    });
  });

  describe('listar', () => {
    it('lista solo las tareas del usuario actual', async () => {
      await service.listar('u1');
      expect(repository.listar).toHaveBeenCalledWith('u1');
    });
  });

  describe('actualizar', () => {
    it('al pasar el estado a HECHA, completa completadaEn', async () => {
      await service.actualizar('tarea1', 'u1', { estado: 'HECHA' as never });
      expect(repository.actualizar).toHaveBeenCalledWith('tarea1', 'u1', expect.objectContaining({ estado: 'HECHA', completadaEn: expect.any(Date) }));
    });

    it('al reabrir (estado distinto de HECHA), limpia completadaEn', async () => {
      await service.actualizar('tarea1', 'u1', { estado: 'PENDIENTE' as never });
      expect(repository.actualizar).toHaveBeenCalledWith('tarea1', 'u1', expect.objectContaining({ estado: 'PENDIENTE', completadaEn: null }));
    });

    it('si no viene estado en el dto, no toca completadaEn', async () => {
      await service.actualizar('tarea1', 'u1', { titulo: 'Nuevo título' });
      const argumentos = repository.actualizar.mock.calls[0][2];
      expect(argumentos).not.toHaveProperty('completadaEn');
    });

    it('convierte fecha string a Date, y null explícito borra la fecha', async () => {
      await service.actualizar('tarea1', 'u1', { fecha: '2026-09-15' });
      expect(repository.actualizar).toHaveBeenCalledWith('tarea1', 'u1', expect.objectContaining({ fecha: new Date('2026-09-15') }));

      await service.actualizar('tarea1', 'u1', { fecha: null });
      expect(repository.actualizar).toHaveBeenCalledWith('tarea1', 'u1', expect.objectContaining({ fecha: null }));
    });
  });

  describe('eliminar', () => {
    it('elimina solo si la tarea es del usuario actual (delegado al repositorio)', async () => {
      await service.eliminar('tarea1', 'u1');
      expect(repository.eliminar).toHaveBeenCalledWith('tarea1', 'u1');
    });
  });

  describe('agregarComentario', () => {
    it('valida que la tarea sea del usuario (404 si no, vía findFirstOrThrow scoped) antes de comentar', async () => {
      repository.buscarPorId.mockRejectedValue(new Error('no encontrada'));
      await expect(service.agregarComentario('tarea1', 'u1', { contenido: 'hola' })).rejects.toThrow('no encontrada');
      expect(repository.crearComentario).not.toHaveBeenCalled();
    });

    it('crea el comentario con el usuario actual como autor', async () => {
      repository.buscarPorId.mockResolvedValue({ id: 'tarea1' } as never);
      await service.agregarComentario('tarea1', 'u1', { contenido: 'hola', imagenes: ['data:image/png;base64,abc'] });
      expect(repository.crearComentario).toHaveBeenCalledWith('tarea1', 'u1', 'hola', ['data:image/png;base64,abc']);
    });
  });

  describe('eliminarComentario', () => {
    it('rechaza si la tarea padre del comentario no es del usuario actual', async () => {
      repository.buscarComentarioPorId.mockResolvedValue({ id: 'c1', tareaId: 'tarea1', autorId: 'u1' } as never);
      repository.buscarPorId.mockRejectedValue(new Error('no encontrada'));
      await expect(service.eliminarComentario('c1', 'u1')).rejects.toThrow('no encontrada');
      expect(repository.eliminarComentario).not.toHaveBeenCalled();
    });

    it('rechaza si el comentario no es del usuario actual (defensivo, aunque nunca debería pasar)', async () => {
      repository.buscarComentarioPorId.mockResolvedValue({ id: 'c1', tareaId: 'tarea1', autorId: 'otro-usuario' } as never);
      repository.buscarPorId.mockResolvedValue({ id: 'tarea1' } as never);
      await expect(service.eliminarComentario('c1', 'u1')).rejects.toThrow(ForbiddenException);
      expect(repository.eliminarComentario).not.toHaveBeenCalled();
    });

    it('elimina el comentario propio', async () => {
      repository.buscarComentarioPorId.mockResolvedValue({ id: 'c1', tareaId: 'tarea1', autorId: 'u1' } as never);
      repository.buscarPorId.mockResolvedValue({ id: 'tarea1' } as never);
      await service.eliminarComentario('c1', 'u1');
      expect(repository.eliminarComentario).toHaveBeenCalledWith('c1');
    });
  });
});
